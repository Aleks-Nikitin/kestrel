import { config } from "dotenv";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readAgentConfig } from "@/lib/agent/config";
import { runSyntheticSpike } from "@/lib/agent/spike";
config({ quiet: true });
it("executes real Gemini native planning and the typed synthetic financial tool", async () => {
  if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is required; the live spike is not skipped.");
  const result = await runSyntheticSpike({ config: readAgentConfig({ ...process.env, ANALYSIS_ENABLED: "true", FALLBACK_ENABLED: "false" }), onDiagnostic: diagnostic => console.info("Safe runtime diagnostic", diagnostic), signal: AbortSignal.timeout(60000) });
  expect(result.canonicalResult.noi).toBe("190000");
  expect(result.execution.nativePlanningObserved).toBe(true);
  expect(result.execution.completedTools.some(t => t.name === "calculateSample")).toBe(true);
  expect(result.execution.effectiveToolInventory).toEqual(["calculateSample", "read_file", "write_todos"]);
  expect(result.modelUsage.provider).toBe("gemini");
  expect(result.modelUsage.attempts).toBeLessThanOrEqual(8);
  expect(result.execution.elapsedMs).toBeLessThanOrEqual(60000);
  console.info("Synthetic Gemini proof:", { model: result.modelUsage.modelId, attempts: result.modelUsage.attempts, elapsedMs: result.execution.elapsedMs, tools: result.execution.completedTools.map(t => t.name) });
});
