import { config } from "dotenv";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ChatOpenRouter } from "@langchain/openrouter";
import { FakeToolCallingModel, type StructuredTool } from "langchain";
import { runPropertyAnalysis } from "@/lib/agent/analysis";
import { readAgentConfig } from "@/lib/agent/config";
import { createComparisonService } from "@/lib/contracts/service";
import { f01, property, spatial } from "../fixtures/contracts";

/** Explicit opt-in, synthetic evidence only. Never fails the running demo primary. */
it.skipIf(process.env.KESTREL_LIVE_FALLBACK !== "true")(
  "uses real OpenRouter typed tools after an eligible injected primary failure",
  async () => {
    config({ quiet: true });
    const settings = readAgentConfig({
      ...process.env,
      ANALYSIS_ENABLED: "true",
      FALLBACK_ENABLED: "true",
    });
    if (!settings.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing.");
    const creditResponse = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${settings.openRouterApiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!creditResponse.ok) throw new Error("OpenRouter credit preflight failed; no model request made.");
    const credit = await creditResponse.json() as { data?: { total_credits: number; total_usage: number } };
    if (!credit.data || !(credit.data.total_credits - credit.data.total_usage > 0))
      throw new Error("OpenRouter has no available credit; no model request made.");
    class TransientPrimary extends FakeToolCallingModel {
      calls = 0;
      override bindTools(tools: StructuredTool[]) { void tools; return this; }
      override async _generate(): Promise<never> {
        this.calls++;
        // Existing policy skips a retry whose delay cannot fit; fallback is eligible.
        throw Object.assign(new Error("Injected synthetic transient failure"), {
          status: 503, headers: { "retry-after": "60" },
        });
      }
    }
    const primary = new TransientPrimary();
    const usage: Record<string, unknown>[] = [];
    const secondary = new ChatOpenRouter({
      model: settings.fallbackModelId, apiKey: settings.openRouterApiKey,
      temperature: 0, maxTokens: 1500, maxRetries: 0,
      provider: { only: ["Anthropic"], allow_fallbacks: false, data_collection: "deny", require_parameters: true },
      callbacks: [{ handleLLMEnd(output) {
        const u = output.llmOutput?.tokenUsage;
        if (u && typeof u === "object") usage.push(u);
      } }],
    });
    const service = createComparisonService({
      property: { async listProperties() { return [property]; }, async getProperty() { return property; } },
      spatial: { async getSpatialContext() { return spatial; } },
    });
    const request = { ...structuredClone(f01), action: "analyze" as const };
    const before = JSON.stringify(request);
    let result;
    try {
      result = await runPropertyAnalysis({ request, config: settings, service,
        models: { primary, secondary }, signal: AbortSignal.timeout(60000) });
    } catch (error) {
      // Do not serialize SDK errors, credentials, prompts or provider response bodies.
      const code = error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN";
      throw new Error(`Live fallback did not complete (${String(code)}). No automatic live rerun.`);
    }
    expect(result.status === "complete").toBe(true);
    if (result.status !== "complete") throw new Error("Synthetic inputs unexpectedly need more information.");
    expect(primary.calls).toBe(1);
    expect(result.modelUsage.provider).toBe("openrouter");
    expect(result.modelUsage.modelId).toBe(settings.fallbackModelId);
    expect(result.modelUsage.fallbackUsed).toBe(true);
    expect(result.modelUsage.attempts).toBeLessThanOrEqual(8);
    expect(result.execution.elapsedMs).toBeLessThanOrEqual(60000);
    expect(result.execution.verification?.status).toBe("verified");
    expect(JSON.stringify(request) === before).toBe(true);
    expect(result.property.id === request.propertyId && result.inputRevision === request.inputRevision).toBe(true);
    const canonical = await service.compare(f01, AbortSignal.timeout(1000));
    expect(JSON.stringify(result.comparison) === JSON.stringify(canonical.comparison)).toBe(true);
    const tools = result.execution.completedTools;
    expect(tools.length).toBeLessThanOrEqual(16);
    for (const name of ["getPropertyContext", "proposeScenarios", "runComparison"])
      expect(tools.filter(t => t.name === name).length).toBe(1);
    expect(tools.some(t => t.name === "verifyAnalysis")).toBe(true);
    const ids = new Set(result.evidence.map(e => e.id));
    expect(result.summary.claims.every(c => c.evidenceIds.every(id => ids.has(id)))).toBe(true);
    console.info("Synthetic live fallback proof", {
      provider: result.modelUsage.provider, model: result.modelUsage.modelId,
      attempts: result.modelUsage.attempts, elapsedMs: result.execution.elapsedMs,
      verification: result.execution.verification, tools: tools.map(t => t.name), usage,
    });
  }, 65000,
);
