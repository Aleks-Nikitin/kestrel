import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FakeToolCallingModel, type StructuredTool } from "langchain";
import { readAgentConfig } from "@/lib/agent/config";
import { runSyntheticSpike } from "@/lib/agent/spike";
const toolCalls = [
  [
    {
      name: "write_todos",
      args: {
        todos: [
          { content: "Calculate synthetic sample", status: "in_progress" },
        ],
      },
      id: "plan",
    },
  ],
  [
    {
      name: "calculateSample",
      args: {
        areaSqft: "10000",
        annualRentPerSqft: "30",
        occupancyRatio: "0.9",
        annualExpenses: "80000",
      },
      id: "calc",
    },
  ],
  [
    {
      name: "write_todos",
      args: {
        todos: [{ content: "Calculate synthetic sample", status: "completed" }],
      },
      id: "done",
    },
  ],
  [],
];
class ScriptedModel extends FakeToolCallingModel {
  calls = 0;
  constructor(
    private readonly failures: number[] = [],
    private readonly alwaysFail = false,
  ) {
    super({ toolCalls });
  }
  override bindTools(tools: StructuredTool[]) {
    void tools;
    return this;
  }
  override async _generate(
    ...args: Parameters<FakeToolCallingModel["_generate"]>
  ) {
    this.calls++;
    const status = this.failures.shift() ?? (this.alwaysFail ? 503 : undefined);
    if (status)
      throw Object.assign(new Error("Synthetic injected provider failure"), {
        status,
      });
    return super._generate(...args);
  }
}
const config = readAgentConfig({
  ANALYSIS_ENABLED: "true",
  FALLBACK_ENABLED: "true",
  OPENROUTER_API_KEY: "fictional-key",
});
describe("native fallback eligibility, state and physical attempt bounds", () => {
  it("retries the primary once before falling back and keeps the secondary sticky", async () => {
    const primary = new ScriptedModel([429, 503]),
      secondary = new ScriptedModel();
    const result = await runSyntheticSpike({
      config,
      signal: AbortSignal.timeout(10000),
      models: { primary, secondary },
    });
    expect(primary.calls).toBe(2);
    expect(secondary.calls).toBe(4);
    expect(result.execution.modelAttempts).toBe(6);
    expect(result.modelUsage).toMatchObject({
      provider: "openrouter",
      fallbackUsed: true,
      attempts: 6,
    });
    expect(result.canonicalResult.noi).toBe("190000");
  });
  it("recovers from one transient primary error without switching", async () => {
    const primary = new ScriptedModel([503]),
      secondary = new ScriptedModel();
    const result = await runSyntheticSpike({
      config,
      signal: AbortSignal.timeout(10000),
      models: { primary, secondary },
    });
    expect(primary.calls).toBe(5);
    expect(secondary.calls).toBe(0);
    expect(result.modelUsage.provider).toBe("gemini");
    expect(result.canonicalResult.noi).toBe("190000");
  });
  it.each([400, 401, 403])(
    "never switches or retries an ineligible %s",
    async (status) => {
      const primary = new ScriptedModel([status]),
        secondary = new ScriptedModel();
      await expect(
        runSyntheticSpike({
          config,
          signal: AbortSignal.timeout(10000),
          models: { primary, secondary },
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(primary.calls).toBe(1);
      expect(secondary.calls).toBe(0);
    },
  );
  it("returns safe failure when both providers are unavailable", async () => {
    const primary = new ScriptedModel([], true),
      secondary = new ScriptedModel([], true);
    await expect(
      runSyntheticSpike({
        config,
        signal: AbortSignal.timeout(10000),
        models: { primary, secondary },
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_UNAVAILABLE", retryable: true });
    expect(primary.calls).toBe(2);
    expect(secondary.calls).toBe(1);
  });
  it("never returns partial success when the physical model cap is reached", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: toolCalls.slice(0, 2),
    });
    await expect(
      runSyntheticSpike({
        config,
        signal: AbortSignal.timeout(10000),
        models: { primary: model },
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_UNAVAILABLE" });
  });
  it("preserves completed native tool results when fallback occurs on a later turn", async () => {
    class LateFailure extends ScriptedModel {
      override async _generate(
        ...args: Parameters<FakeToolCallingModel["_generate"]>
      ) {
        if (this.index === 2) {
          this.calls++;
          throw Object.assign(new Error("Injected late transient failure"), {
            status: 503,
          });
        }
        return super._generate(...args);
      }
    }
    const primary = new LateFailure(),
      secondary = new ScriptedModel();
    secondary.index = 2;
    const result = await runSyntheticSpike({
      config,
      signal: AbortSignal.timeout(10000),
      models: { primary, secondary },
    });
    expect(result.canonicalResult.noi).toBe("190000");
    expect(
      result.execution.completedTools.filter(
        (t) => t.name === "calculateSample",
      ),
    ).toHaveLength(1);
    expect(result.modelUsage.fallbackUsed).toBe(true);
  });
});
