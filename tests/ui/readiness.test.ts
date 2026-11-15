import { describe, expect, it } from "vitest";
import { editorReducer } from "../../features/scenarios/editor-state";
import { initialModel, type EditorModel, type ScenarioForm } from "../../features/scenarios/model";
import { constraintsNeed, describeMissing, readiness, scenarioNeeds } from "../../features/scenarios/readiness";
import { property } from "../fixtures/contracts";

const d = (text: string) => ({ text, accepted: false });
function complete(s: ScenarioForm): ScenarioForm {
  return {
    ...s,
    leaseBasis: "modified_gross",
    rentNormalizationNote: "Quoted gross rent restated annually.",
    rentableAreaSqft: d("10000"),
    annualRentPerSqft: d("20"),
    occupancyRatio: d("0.9"),
    collectionLossRatio: d("0.02"),
    annualConcessions: d("0"),
    otherIncomeMode: "none_modeled",
    expenseTotal: d("100000"),
    expenseTotalNote: "Taxes, insurance, upkeep.",
    capex: { renovation: d("1"), conversion: d("0"), softCosts: d("0"), contingency: d("0"), other: d("0") },
  };
}
const model = (): EditorModel => initialModel(property, 2026);

describe("recommendation readiness", () => {
  it("lists what a blank alternative still needs, from the server's existing rules", () => {
    const m = model();
    const needs = scenarioNeeds(m.scenarios[1], m.constraints);
    expect(Object.keys(needs)).toEqual(
      expect.arrayContaining(["leaseBasis", "rentNormalizationNote", "annualRentPerSqft", "otherIncome", "expenseTotal", "capex.renovation", "capex.other"]),
    );
    expect(needs.leaseBasis).toMatch(/Triple net and Unknown are not supported/);
  });
  it("does not count capital for the baseline", () => {
    const m = model();
    expect(Object.keys(scenarioNeeds(m.scenarios[0], m.constraints)).some((k) => k.startsWith("capex"))).toBe(false);
  });
  it("treats triple net as still needing a supported basis", () => {
    const m = model();
    const s = { ...complete(m.scenarios[1]), leaseBasis: "nnn" as const };
    expect(Object.keys(scenarioNeeds(s, m.constraints))).toEqual(["leaseBasis"]);
  });
  it("is satisfied by a complete scenario and never defaults anything", () => {
    const m = model();
    expect(scenarioNeeds(complete(m.scenarios[1]), m.constraints)).toEqual({});
    expect(m.scenarios[1].annualRentPerSqft.text).toBe("");
  });
  it("needs a total project cost only when a minimum yield is set", () => {
    const m = model();
    const s = complete(m.scenarios[1]);
    expect(scenarioNeeds(s, m.constraints).totalProjectCost).toBeUndefined();
    expect(scenarioNeeds(s, { ...m.constraints, minimumYieldOnCost: d("0.05") }).totalProjectCost).toMatch(/total project cost/);
  });
  it("needs at least one investment constraint", () => {
    const m = model();
    expect(constraintsNeed(m.constraints)).toMatch(/at least one/);
    expect(constraintsNeed({ ...m.constraints, maxPaybackYears: d("10") })).toBeNull();
    expect(readiness(m).constraints).not.toBeNull();
  });
  it("requires the existing cost-basis note when a yield constraint is supplied", () => {
    const m = model();
    const scenario = { ...complete(m.scenarios[1]), totalProjectCost: d("1000000") };
    const constraints = { ...m.constraints, minimumYieldOnCost: d("0.05") };
    expect(scenarioNeeds(scenario, constraints).totalProjectCostNote).toMatch(/cost basis/);
    expect(scenarioNeeds({ ...scenario, totalProjectCostNote: "Disclosed hypothetical existing basis plus capex." }, constraints)).toEqual({});
    expect(scenario.totalProjectCostNote).toBe("");
  });
  it("totals across scenarios and constraints", () => {
    const m = model();
    const r = readiness(m);
    expect(r.total).toBe(Object.values(r.byScenario).reduce((n, x) => n + Object.keys(x).length, 0) + 1);
  });
});

describe("scenario values persist across tabs", () => {
  it("keeps every scenario's own fields when others are edited", () => {
    let m = model();
    const [a, b, c] = m.scenarios.map((s) => s.id);
    m = editorReducer(m, { type: "patch_scenario", id: a, patch: { annualRentPerSqft: d("11") } });
    m = editorReducer(m, { type: "patch_scenario", id: b, patch: { annualRentPerSqft: d("22"), rentNormalizationNote: "b note" } });
    m = editorReducer(m, { type: "patch_scenario", id: c, patch: { annualRentPerSqft: d("33") } });
    m = editorReducer(m, { type: "patch_scenario", id: a, patch: { proposedUse: "Retail" } });
    const by = (id: string) => m.scenarios.find((s) => s.id === id)!;
    expect([by(a).annualRentPerSqft.text, by(b).annualRentPerSqft.text, by(c).annualRentPerSqft.text]).toEqual(["11", "22", "33"]);
    expect(by(b).rentNormalizationNote).toBe("b note");
    expect(by(c).rentNormalizationNote).toBe("");
    expect(by(a).proposedUse).toBe("Retail");
  });
  it("keeps constraints when a scenario is edited", () => {
    let m = model();
    m = editorReducer(m, { type: "patch_constraints", patch: { maxPaybackYears: d("9") } });
    m = editorReducer(m, { type: "patch_scenario", id: "baseline", patch: { name: "Now" } });
    expect(m.constraints.maxPaybackYears.text).toBe("9");
  });
});

describe("missing-input messages", () => {
  const nameOf = (id: string) => (id === "alternative-a" ? "Alternative A" : id);
  it("names the scenario and field in plain words", () => {
    expect(describeMissing("alternative-a.leaseBasis: Supported lease normalization is required.", nameOf)).toBe(
      "Alternative A — lease basis and rent normalization note: Supported lease normalization is required.",
    );
    expect(describeMissing("alternative-a.initialInvestment: Required by x.", nameOf)).toContain("initial investment (all capital lines)");
  });
  it("labels constraint and unknown shapes without losing the server text", () => {
    expect(describeMissing("constraints: Supply a capital or return constraint.", nameOf)).toBe("Constraints: Supply a capital or return constraint.");
    expect(describeMissing("free text", nameOf)).toBe("free text");
  });
});
