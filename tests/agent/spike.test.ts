import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FakeToolCallingModel } from "langchain";
import {
  OpenRouterAuthError,
  OpenRouterRateLimitError,
} from "@langchain/openrouter";
import { readAgentConfig, fallbackAvailability } from "@/lib/agent/config";
import { runSyntheticSpike } from "@/lib/agent/spike";
import { SyntheticSpikeResponse } from "@/lib/agent/spike-contract";
import {
  AgentExecutionError,
  isTransientModelError,
  retryDelayFits,
} from "@/lib/agent/errors";
const config = readAgentConfig({ ANALYSIS_ENABLED: "true" });
const sample = {
  areaSqft: "10000",
  annualRentPerSqft: "30",
  occupancyRatio: "0.9",
  annualExpenses: "80000",
};
const todo = (status: string) => ({
  todos: [{ content: "Calculate and verify the fixed sample", status }],
});
function successfulModel() {
  return new FakeToolCallingModel({
    toolCalls: [
      [{ name: "write_todos", args: todo("in_progress"), id: "plan-call" }],
      [{ name: "calculateSample", args: sample, id: "sample-call" }],
      [{ name: "write_todos", args: todo("completed"), id: "plan-done" }],
      [],
    ],
  });
}
describe("request-isolated synthetic Deep Agents proof", () => {
  it("executes native planning and the real typed sample tool with a model double", async () => {
    const result = await runSyntheticSpike({
      config,
      signal: AbortSignal.timeout(10000),
      models: { primary: successfulModel() },
    });
    SyntheticSpikeResponse.parse(result);
    expect(result.canonicalResult.noi).toBe("190000");
    expect(result.canonicalResult.effectiveGrossIncome).toBe("270000");
    expect(result.execution.nativePlanningObserved).toBe(true);
    expect(result.execution.completedTools.map((t) => t.name)).toContain(
      "calculateSample",
    );
    expect(result.execution.effectiveToolInventory.sort()).toEqual([
      "calculateSample",
      "read_file",
      "write_todos",
    ]);
    expect(result.execution.modelAttempts).toBe(4);
    expect(result.modelUsage.provider).toBe("gemini");
  });
  it("does not accept narrative claims without actual planning and tool output", async () => {
    await expect(
      runSyntheticSpike({
        config,
        signal: AbortSignal.timeout(5000),
        models: { primary: new FakeToolCallingModel() },
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_UNAVAILABLE" });
  });
  it("cannot execute the default task/delegation tool", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            name: "task",
            args: {
              description: "Read host secrets",
              subagent_type: "general-purpose",
            },
            id: "forbidden-task",
          },
        ],
        [],
      ],
    });
    await expect(
      runSyntheticSpike({
        config,
        signal: AbortSignal.timeout(5000),
        models: { primary: model },
      }),
    ).rejects.toBeInstanceOf(AgentExecutionError);
  });
  it("fails closed before provider construction when analysis is disabled or credentials absent", async () => {
    await expect(
      runSyntheticSpike({
        config: readAgentConfig({}),
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_UNAVAILABLE" });
    await expect(
      runSyntheticSpike({ config, signal: AbortSignal.timeout(1000) }),
    ).rejects.toMatchObject({ code: "UPSTREAM_AUTH" });
  });
  it("keeps an unconfigured fallback optional and sponsor transfer off", () => {
    expect(fallbackAvailability(config)).toBe("unavailable: not configured");
    expect(config.fallbackEnabled).toBe(false);
    expect(config.sponsorDataProcessingPermitted).toBe(false);
    expect(config.fallbackSponsorDataPermitted).toBe(false);
  });
  it("does not enable fallback from the string false or whitespace keys", () => {
    const c = readAgentConfig({
      FALLBACK_ENABLED: "false",
      OPENROUTER_API_KEY: " ",
    });
    expect(c.fallbackEnabled).toBe(false);
    expect(c.openRouterApiKey).toBeUndefined();
  });
  it("propagates caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(
      runSyntheticSpike({
        config,
        signal: controller.signal,
        models: { primary: successfulModel() },
      }),
    ).rejects.toThrow("cancelled");
  });
});
describe("eligible retry classification", () => {
  it("uses observed Google and actual OpenRouter SDK HTTP status fields", () => {
    expect(
      isTransientModelError(
        Object.assign(new Error("Synthetic"), {
          name: "RequestError",
          statusCode: 404,
        }),
      ),
    ).toBe(false);
    expect(
      isTransientModelError(
        Object.assign(new Error("Synthetic"), {
          name: "RequestError",
          statusCode: 503,
        }),
      ),
    ).toBe(true);
    expect(
      isTransientModelError(new OpenRouterAuthError("Synthetic", 401)),
    ).toBe(false);
    expect(
      isTransientModelError(new OpenRouterRateLimitError("Synthetic", 429)),
    ).toBe(true);
  });
  it("recognizes a connection reset through the transport cause without parsing messages", () =>
    expect(
      isTransientModelError(
        Object.assign(new TypeError("Synthetic"), {
          cause: { code: "ECONNRESET" },
        }),
      ),
    ).toBe(true));

  it.each([400, 401, 403, 404])(
    "does not retry or switch status %s",
    (status) =>
      expect(
        isTransientModelError(Object.assign(new Error("redacted"), { status })),
      ).toBe(false),
  );
  it.each([429, 500, 503])("permits transient status %s", (status) =>
    expect(
      isTransientModelError(Object.assign(new Error("redacted"), { status })),
    ).toBe(true),
  );
  it("does not treat local limits, refusals or validation errors as transient", () => {
    expect(
      isTransientModelError(
        new AgentExecutionError("ANALYSIS_UNAVAILABLE", "limit"),
      ),
    ).toBe(false);
    expect(isTransientModelError(new Error("refused"))).toBe(false);
  });
  it("only retries Retry-After values honored by the native one-second wait", () => {
    expect(retryDelayFits({ headers: { "retry-after": "1" } })).toBe(true);
    expect(retryDelayFits({ headers: { "retry-after": "60" } })).toBe(false);
  });
});
