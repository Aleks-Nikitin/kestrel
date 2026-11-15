import { describe, expect, it } from "vitest";
import { buildInvestigation, toolLabel } from "../../features/analysis/investigation";
import { analysis, fallbackAnalysis } from "../fixtures/contracts";

function complete() {
  if (analysis.status !== "complete") throw new Error("fixture");
  return structuredClone(analysis);
}

describe("investigation view-model", () => {
  it("mirrors the backend's completed tools and resolves their evidence", () => {
    const i = buildInvestigation(complete());
    expect(i.steps).toHaveLength(1);
    expect(i.steps[0]).toMatchObject({ name: "runComparison", toolCallId: "synthetic-call", label: "Run comparison" });
    expect(i.steps[0].evidence.map((e) => e.id)).toEqual(["synthetic-assumption"]);
    expect(i.evidenceTouched).toBe(1);
    expect(i.syntheticEvidence).toBe(true);
  });

  it("never reports a verification result the contract does not carry", () => {
    expect(buildInvestigation(complete()).verification).toBeNull();
  });

  it("flags evidence ids that are not in the evidence table instead of inventing them", () => {
    const r = complete();
    r.execution.completedTools[0].evidenceIds = ["synthetic-assumption", "ghost"];
    const s = buildInvestigation(r).steps[0];
    expect(s.unresolved).toEqual(["ghost"]);
    expect(s.evidence).toHaveLength(1);
  });

  it("counts factual claims with and without cited support from real data", () => {
    const r = complete();
    const base = r.summary.claims[0];
    r.summary.claims = [
      { ...base, kind: "fact", evidenceIds: ["synthetic-assumption"], metricRefs: [] },
      { ...base, kind: "fact", evidenceIds: [], metricRefs: [] },
      { ...base, kind: "inference" },
    ];
    const c = buildInvestigation(r).claims;
    expect(c).toMatchObject({ total: 3, facts: 2, factsWithCitedSupport: 1, factsWithoutCitedSupport: 1, assumptionsAndInferences: 1 });
  });

  it("reports model fallback and attempts as model attempts, not corrections", () => {
    if (fallbackAnalysis.status !== "complete") throw new Error("fixture");
    const i = buildInvestigation(fallbackAnalysis);
    expect(i.model).toMatchObject({ fallbackUsed: true, attempts: 3 });
    expect(Object.keys(i)).not.toContain("correction");
  });

  it("humanizes tool names without altering the raw name", () => {
    expect(toolLabel("get_spatial-context")).toBe("Get spatial context");
    expect(toolLabel("runComparison")).toBe("Run comparison");
  });
});
