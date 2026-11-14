import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FakeToolCallingModel } from "langchain";
import { AnalysisResponse, type AnalysisRequestDTO } from "@/lib/contracts";
import { createComparisonService } from "@/lib/contracts/service";
import { readAgentConfig } from "@/lib/agent/config";
import { runPropertyAnalysis } from "@/lib/agent/analysis";
import { f01, property, spatial } from "../fixtures/contracts";
const request: AnalysisRequestDTO = { ...f01, action: "analyze" };
const config = readAgentConfig({ ANALYSIS_ENABLED: "true" });
function model() {
  return new FakeToolCallingModel({
    toolCalls: [
      [
        {
          name: "write_todos",
          args: {
            todos: [
              {
                content: "Validate candidates and compare",
                status: "in_progress",
              },
            ],
          },
          id: "plan",
        },
      ],
      [
        {
          name: "getPropertyContext",
          args: { propertyId: property.id },
          id: "get-context",
        },
      ],
      [
        {
          name: "proposeScenarios",
          args: { scenarioIds: f01.scenarios.map((s) => s.id) },
          id: "proposals",
        },
      ],
      [
        {
          name: "runComparison",
          args: { propertyId: property.id, inputRevision: f01.inputRevision },
          id: "comparison",
        },
      ],
      [
        {
          name: "write_todos",
          args: {
            todos: [
              {
                content: "Validate candidates and compare",
                status: "completed",
              },
            ],
          },
          id: "done",
        },
      ],
      [],
    ],
  });
}
function service(p = property, s = spatial) {
  return createComparisonService({
    property: { listProperties: async () => [p], getProperty: async () => p },
    spatial: { getSpatialContext: async () => s },
  });
}
describe("bounded native property analysis", () => {
  it("executes all three actual domain tools and returns canonical comparison and summary", async () => {
    const response = await runPropertyAnalysis({
      request,
      config,
      signal: AbortSignal.timeout(15000),
      service: service(),
      models: { primary: model() },
    });
    AnalysisResponse.parse(response);
    expect(response.status).toBe("complete");
    if (response.status !== "complete")
      throw new Error("Expected complete synthetic analysis");
    expect(response.execution.completedTools.map((t) => t.name)).toEqual([
      "write_todos",
      "getPropertyContext",
      "proposeScenarios",
      "runComparison",
      "write_todos",
    ]);
    expect(
      response.comparison.results.find((r) => r.scenarioId === "alternative-b")
        ?.noi.value,
    ).toBe("195000");
    expect(response.summary.preferredScenarioId).toBe(
      response.comparison.preferredScenarioId,
    );
    expect(response.modelUsage.attempts).toBe(6);
    expect(response.execution.dataMode).toBe("synthetic");
  });
  it("preserves a baseline draft and explicit unknowns as needs_input without invoking a model", async () => {
    const primary = model();
    const input = structuredClone(request);
    input.scenarios = [input.scenarios[0]];
    input.scenarios[0].annualRentPerSqft.value = null;
    const response = await runPropertyAnalysis({
      request: input,
      config,
      signal: AbortSignal.timeout(1000),
      service: service(),
      models: { primary },
    });
    expect(response.status).toBe("needs_input");
    expect(response.scenarios[0].annualRentPerSqft.value).toBeNull();
    expect(primary.index).toBe(0);
    if (response.status === "needs_input")
      expect(
        response.missingInputs.some(
          (i) => i.path === "scenarios.0.annualRentPerSqft",
        ),
      ).toBe(true);
  });
  it("does not transmit sponsor data when processing is disabled", async () => {
    const p = structuredClone(property);
    p.dataMode = "sponsor_dataset";
    p.evidence = p.evidence.map((e) => ({
      ...e,
      synthetic: false,
      allowedUse: { ...e.allowedUse, modelProcessing: false },
    }));
    const primary = model();
    await expect(
      runPropertyAnalysis({
        request,
        config,
        signal: AbortSignal.timeout(1000),
        service: service(p),
        models: { primary },
      }),
    ).rejects.toMatchObject({ code: "LICENSE_RESTRICTED" });
    expect(primary.index).toBe(0);
  });
  it("rejects narration without executed tools and unauthorized delegation", async () => {
    await expect(
      runPropertyAnalysis({
        request,
        config,
        signal: AbortSignal.timeout(1000),
        service: service(),
        models: { primary: new FakeToolCallingModel() },
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_UNAVAILABLE" });
    const primary = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            name: "task",
            args: { description: "Delegate", subagent_type: "general-purpose" },
            id: "bad",
          },
        ],
        [],
      ],
    });
    await expect(
      runPropertyAnalysis({
        request,
        config,
        signal: AbortSignal.timeout(1000),
        service: service(),
        models: { primary },
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_UNAVAILABLE" });
  });
});
