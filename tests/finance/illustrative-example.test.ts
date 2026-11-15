import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ComparisonRequest } from "@/lib/contracts";
import { createIllustrativeInvestmentExample, ILLUSTRATIVE_EXAMPLE_DISCLOSURE } from "@/lib/scenarios/illustrative-example";
import { buildRequest, initialModel, validateModel } from "@/features/scenarios/model";
import { editorReducer } from "@/features/scenarios/editor-state";
import { readiness } from "@/features/scenarios/readiness";
import { initialState, reducer, isAnalysisStale, isCompareStale } from "@/features/dashboard/state";
import { createComparisonService } from "@/lib/contracts/service";
import { normalizeScenarioInputs } from "@/lib/contracts/normalize";
import { property as fixtureProperty, spatial, comparison, analysis } from "../fixtures/contracts";

// A fictional recorded-area datum for source/assumption separation tests.
// The shared frozen fixture remains an explicit estimate and is not changed.
const property = { ...fixtureProperty, rentableAreaSqft: { ...fixtureProperty.rentableAreaSqft, origin: "source_data" as const } };

function example(p = property, year = 2026) {
  const result = createIllustrativeInvestmentExample(p, year);
  if (!result.ok) throw Error(result.message);
  return result.model;
}

describe("explicit illustrative investment draft", () => {
  it("leaves ordinary initial drafts unchanged and prepares a complete typed example only on request", () => {
    expect(initialModel(property, 2026).scenarios[1].annualRentPerSqft.text).toBe("");
    const model = example();
    ComparisonRequest.parse(buildRequest(model, property.id, 41));
    const needs = readiness(model);
    expect(needs.constraints).toBeNull();
    expect(needs.total).toBe(0);
    expect(Object.values(needs.byScenario).every(n => Object.keys(n).length === 0)).toBe(true);
    expect(model.scenarios).toHaveLength(3);
    expect(model.scenarios.every(s => s.leaseBasis === "gross" && s.rentNormalizationNote.includes("Illustrative"))).toBe(true);
    expect(model.constraints.maxInitialInvestment.text).toBe("2000000");
    expect(model.constraints.maxPaybackYears.text).toBe("10");
    expect(model.constraints.minimumYieldOnCost.text).toBe("");
  });

  it("keeps all financial assumptions hypothetical even when rent and occupancy equal source values", () => {
    const p = structuredClone(property);
    p.marketRentAnnualPerSqft = { ...p.marketRentAnnualPerSqft, value: "14", origin: "source_data" };
    p.occupancyRatio = { ...p.occupancyRatio, value: "0.85", origin: "source_data" };
    const input = buildRequest(example(p), p.id, 2);
    const result = normalizeScenarioInputs(p, input.scenarios, { inputRevision: 2 });
    expect(result.scenarios.every(s => s.annualRentPerSqft.origin === "user_input" && s.occupancyRatio.origin === "user_input")).toBe(true);
    expect(result.scenarios.every(s => s.rentableAreaSqft.origin === "source_data")).toBe(true);
    expect(result.scenarios.every(s => s.totalProjectCost.origin === "user_input" && s.assumptions.some(a => a.includes("not sponsor facts")))).toBe(true);
    expect(ILLUSTRATIVE_EXAMPLE_DISCLOSURE).toContain("hypothetical");
    expect(ILLUSTRATIVE_EXAMPLE_DISCLOSURE).toContain("replaces");
  });

  it("preserves the exact recorded area, property evidence, input year and independent drafts", () => {
    const p = structuredClone(property); p.rentableAreaSqft.value = "10000.00";
    const before = structuredClone(p);
    const a = example(p, 2027), b = example(p, 2027);
    expect(a.scenarios.every(s => s.rentableAreaSqft.text === "10000.00" && !s.rentableAreaSqft.accepted)).toBe(true);
    expect(buildRequest(a, p.id, 1).scenarios.every(s => s.period.start === "2027-01-01")).toBe(true);
    a.scenarios[1].capex.renovation.text = "1";
    expect(b.scenarios[1].capex.renovation.text).toBe("100000");
    expect(p).toEqual(before);
  });

  it("refuses missing, zero or assumed rentable area rather than deriving it from rooms", () => {
    for (const change of [{ value: null }, { value: "0" }, { origin: "explicit_estimate" as const }]) {
      const p = structuredClone(property); Object.assign(p.rentableAreaSqft, change);
      expect(createIllustrativeInvestmentExample(p, 2026)).toMatchObject({ ok: false, reason: "RECORDED_AREA_REQUIRED" });
    }
    expect(createIllustrativeInvestmentExample(property, 2026.5)).toMatchObject({ ok: false, reason: "INVALID_DRAFT" });
  });

  it("keeps all five upfront costs separate from the disclosed total-project-cost basis", () => {
    const request = buildRequest(example(), property.id, 1);
    expect(Object.values(request.scenarios[1].capex).map(d => d.value)).toEqual(["100000", "0", "15000", "15000", "0"]);
    expect(request.scenarios[1].totalProjectCost.value).toBe("6130000");
    expect(request.scenarios[1].totalProjectCost.note).toContain("Not an appraisal");
    expect(Object.values(request.scenarios[0].capex).every(d => d.value === "0")).toBe(true);
  });

  it("uses the existing financial engine to change eligibility when only the budget changes", async () => {
    // Fictional test area, not the selected sponsor property's recorded value.
    const p = structuredClone(property); p.rentableAreaSqft.value = "60000"; p.grossAreaSqft.value = "72000";
    const service = createComparisonService({ property: { async listProperties() { return [p]; }, async getProperty() { return p; } }, spatial: { async getSpatialContext() { return spatial; } } });
    const firstRequest = buildRequest(example(p), p.id, 7);
    const secondRequest = structuredClone(firstRequest);
    secondRequest.inputRevision++;
    secondRequest.constraints.maxInitialInvestment.value = "1000000";
    expect(secondRequest.scenarios).toEqual(firstRequest.scenarios);
    const first = await service.compare(firstRequest, AbortSignal.timeout(1000));
    const second = await service.compare(secondRequest, AbortSignal.timeout(1000));
    expect(first.comparison.preferredScenarioId).toBe("alternative-b");
    expect(second.comparison.preferredScenarioId).toBe("alternative-a");
    expect(second.comparison.feasibility.find(f => f.scenarioId === "alternative-b")?.eligibility).toBe("excluded");
    expect(first.comparison.results.map(r => r.noi.value)).toEqual(["466860", "555360", "632280"]);
    expect(first.comparison.results.map(r => r.initialInvestment.value)).toEqual(["0", "780000", "1560000"]);
  });

  it("remains editable and uses the existing single revision bump to invalidate older results", () => {
    let state = reducer(initialState, { type: "select", propertyId: property.id });
    state = reducer(state, { type: "compare_finished", propertyId: property.id, inputRevision: 1, response: comparison });
    state = reducer(state, { type: "analysis_finished", propertyId: property.id, inputRevision: 1, response: analysis });
    const loaded = example();
    state = reducer(state, { type: "revision_bumped" });
    expect(state.inputRevision).toBe(2);
    expect(isAnalysisStale(state)).toBe(true);
    expect(isCompareStale(state)).toBe(true);
    expect(buildRequest(loaded, property.id, state.inputRevision).inputRevision).toBe(2);
    expect(reducer(state, { type: "compare_finished", propertyId: property.id, inputRevision: 1, response: comparison })).toBe(state);
    const edited = editorReducer(loaded, { type: "patch_scenario", id: "alternative-a", patch: { annualRentPerSqft: { text: "17", accepted: false } } });
    expect(edited.scenarios[1].annualRentPerSqft.text).toBe("17");
    expect(loaded.scenarios[1].annualRentPerSqft.text).toBe("16");
    const invalid = editorReducer(edited, { type: "patch_scenario", id: "alternative-a", patch: { annualRentPerSqft: { text: "invalid", accepted: false } } });
    expect(validateModel(invalid, property.id, 3).request).toBeNull();
  });
});
