import { describe, expect, it } from "vitest";
import { property, propertyId } from "../fixtures/contracts";
import {
  blank,
  buildRequest,
  initialModel,
  problemCount,
  propertyProposals,
  validateDecimal,
  validateModel,
  type EditorModel,
} from "@/features/scenarios/model";

function valid(): EditorModel {
  const m = initialModel(property, 2026);
  m.scenarios = m.scenarios.map((s) => ({ ...s, proposedUse: s.proposedUse || "Self storage" }));
  return m;
}

describe("validateDecimal", () => {
  it("treats empty as unknown, not an error", () => {
    expect(validateDecimal("", "amount")).toBeNull();
    expect(validateDecimal("   ", "positive")).toBeNull();
  });
  it("rejects commas, symbols and exponents with a plain explanation", () => {
    for (const bad of ["1,000", "$5", "1e3", "abc", "1."]) {
      expect(validateDecimal(bad, "amount")).toMatch(/plain number/);
    }
  });
  it("applies the contract kind rules", () => {
    expect(validateDecimal("0", "positive")).not.toBeNull();
    expect(validateDecimal("1.5", "ratio")).not.toBeNull();
    expect(validateDecimal("0.85", "ratio")).toBeNull();
    expect(validateDecimal("-1200", "amount")).toBe("Must be nonnegative");
    expect(validateDecimal("1200.50", "amount")).toBeNull();
  });
});

describe("initialModel", () => {
  it("creates a baseline and two alternatives", () => {
    const m = initialModel(property, 2026);
    expect(m.scenarios.map((s) => [s.id, s.role])).toEqual([
      ["baseline", "baseline"],
      ["alternative-a", "alternative"],
      ["alternative-b", "alternative"],
    ]);
  });
  it("never prefills estimates and never accepts anything", () => {
    const m = initialModel(property, 2026);
    for (const s of m.scenarios) {
      expect(s.rentableAreaSqft.accepted).toBe(false);
      expect(s.annualRentPerSqft.text).toBe("");
    }
  });
});

describe("propertyProposals", () => {
  it("offers only known values with their origin", () => {
    const p = propertyProposals(property);
    if (property.rentableAreaSqft.value !== null)
      expect(p.rentableAreaSqft).toEqual({
        value: property.rentableAreaSqft.value,
        origin: property.rentableAreaSqft.origin,
      });
    if (property.marketRentAnnualPerSqft.value === null) expect(p.annualRentPerSqft).toBeUndefined();
  });
});

describe("buildRequest", () => {
  it("keeps decimal strings exactly as typed", () => {
    const m = valid();
    m.scenarios[1].annualRentPerSqft = { text: "12.50", accepted: false };
    const r = buildRequest(m, propertyId, 3);
    expect(r.inputRevision).toBe(3);
    expect(r.scenarios[1].annualRentPerSqft).toEqual({ value: "12.50" });
  });
  it("leaves blanks unknown rather than defaulting them to zero", () => {
    const r = buildRequest(valid(), propertyId, 1);
    expect(r.scenarios[1].occupancyRatio).toEqual({ value: null });
    expect(r.scenarios[1].otherEffectiveAnnualIncome).toEqual({ value: null });
    expect(r.scenarios[1].capex.renovation).toEqual({ value: null });
  });
  it("sends explicit zero other income only when the user chose it", () => {
    const m = valid();
    m.scenarios[1].otherIncomeMode = "none_modeled";
    const s = buildRequest(m, propertyId, 1).scenarios[1];
    expect(s.otherPotentialAnnualIncome.value).toBe("0");
    expect(s.otherEffectiveAnnualIncome).toMatchObject({ value: "0", note: expect.stringMatching(/No other income modeled/) });
  });
  it("flags accepted estimates", () => {
    const m = valid();
    m.scenarios[1].occupancyRatio = { text: "0.9", accepted: true };
    expect(buildRequest(m, propertyId, 1).scenarios[1].occupancyRatio).toEqual({
      value: "0.9",
      acceptedEstimate: true,
    });
  });
  it("sends baseline capex as zero and itemized expenses with all categories", () => {
    const m = valid();
    m.scenarios[1].expenseMode = "itemized";
    const r = buildRequest(m, propertyId, 1);
    expect(r.scenarios[0].capex.renovation).toEqual({ value: "0" });
    const ops = r.scenarios[1].operatingExpenses;
    expect(ops.mode).toBe("itemized");
    if (ops.mode === "itemized") expect(ops.items).toHaveLength(6);
  });
});

describe("validateModel", () => {
  it("builds a request when every field is empty or valid", () => {
    const v = validateModel(valid(), propertyId, 1);
    expect(v.fieldErrors).toEqual({});
    expect(v.request).not.toBeNull();
  });
  it("blocks the request and points at the offending field", () => {
    const m = valid();
    m.scenarios[2].annualRentPerSqft = { text: "12,5", accepted: false };
    const v = validateModel(m, propertyId, 1);
    expect(v.request).toBeNull();
    expect(v.fieldErrors["alternative-b:annualRentPerSqft"]).toBeTruthy();
    expect(problemCount(v, "alternative-b")).toBe(1);
    expect(problemCount(v, "alternative-a")).toBe(0);
  });
  it("requires a note describing a total expense figure", () => {
    const m = valid();
    m.scenarios[1].expenseTotal = { text: "50000", accepted: false };
    expect(validateModel(m, propertyId, 1).fieldErrors["alternative-a:expenseTotalNote"]).toBeTruthy();
    m.scenarios[1].expenseTotalNote = "Taxes, insurance, upkeep";
    expect(validateModel(m, propertyId, 1).request).not.toBeNull();
  });
  it("requires a name and proposed use", () => {
    const m = valid();
    m.scenarios[1].name = " ";
    m.scenarios[2].proposedUse = "";
    const v = validateModel(m, propertyId, 1);
    expect(v.fieldErrors["alternative-a:name"]).toBeTruthy();
    expect(v.fieldErrors["alternative-b:proposedUse"]).toBeTruthy();
  });
  it("validates constraints", () => {
    const m = valid();
    m.constraints.minimumYieldOnCost = { text: "2", accepted: false };
    expect(validateModel(m, propertyId, 1).fieldErrors["constraints:minimumYieldOnCost"]).toBeTruthy();
    m.constraints.minimumYieldOnCost = blank();
    expect(validateModel(m, propertyId, 1).request).not.toBeNull();
  });
});
