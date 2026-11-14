import { describe, expect, it } from "vitest";
import { compareScenarios } from "@/lib/feasibility/compare";
import { calculateFinancials, FinanceDecimal } from "@/lib/finance/calculate";
import { f01, f03, f04, f04Edited, property } from "../fixtures/contracts";
import { constraintsFor, scenarioSet, setValue } from "../finance/helpers";
import type { ComparisonRequestDTO, PropertyDTO } from "@/lib/contracts";
function compare(input: ComparisonRequestDTO = f01) {
  const scenarios = scenarioSet(input);
  return compareScenarios(
    scenarios,
    calculateFinancials(scenarios),
    constraintsFor(input),
    property,
    input.inputRevision,
  );
}
function documented(
  dimension: "legal" | "physical",
  use: string,
  finding: "supported" | "excluded",
): PropertyDTO {
  const p = structuredClone(property);
  const id = `synthetic-${dimension}`;
  p.evidence.push({
    ...p.evidence[0],
    id,
    provider: "costar",
    kind: "record",
    label: "Fictional authoritative-source test evidence",
  });
  p.documentedConstraints.push({
    id,
    dimension,
    appliesToUses: [use],
    finding,
    explanation: `Fictional ${dimension} finding`,
    evidenceIds: [id],
  });
  return p;
}
describe("transparent constrained comparison", () => {
  it("reproduces F01 budget-only preferences and keeps HBU questions separate", () => {
    const result = compare();
    expect(result.preferredScenarioId).toBe("alternative-b");
    expect(result.conclusion).toBe("conditional_preference");
    expect(result.rankedScenarioIds).toEqual([
      "alternative-b",
      "alternative-a",
    ]);
    expect(
      result.reasons.some((r) =>
        r.text.includes("investment return is not established"),
      ),
    ).toBe(true);
    for (const feasibility of result.feasibility) {
      expect(new Set(feasibility.checks.map((c) => c.dimension))).toEqual(
        new Set(["legal", "physical", "financial", "risk"]),
      );
      expect(feasibility.productivity.status).toBe("not_established");
    }
    const input = structuredClone(f01);
    input.constraints.maxInitialInvestment.value = "350000";
    expect(compare(input).preferredScenarioId).toBe("alternative-a");
  });
  it("reproduces F04 payback, occupancy and budget adaptation", () => {
    expect(compare(f04).preferredScenarioId).toBe("alternative-a");
    expect(compare(f04Edited).preferredScenarioId).toBe("alternative-b");
    const input = structuredClone(f04Edited);
    input.constraints.maxInitialInvestment.value = "350000";
    expect(compare(input).preferredScenarioId).toBe("alternative-a");
  });
  it("retains a positive baseline when all alternatives fail known constraints", () => {
    const input = structuredClone(f01);
    input.constraints.maxInitialInvestment.value = "1";
    const result = compare(input);
    expect(result.preferredScenarioId).toBe("baseline");
    expect(result.conclusion).toBe("retain_baseline");
  });
  it("does not prefer any scenario without a capital or return constraint", () => {
    const input = structuredClone(f01);
    input.constraints.maxInitialInvestment.value = null;
    const result = compare(input);
    expect(result.preferredScenarioId).toBeNull();
    expect(result.conclusion).toBe("insufficient_evidence");
    expect(result.rankedScenarioIds).toEqual([
      "alternative-b",
      "alternative-a",
    ]);
  });
  it("lets unknown zoning stay conditional at moderate/high tolerance, but not low", () => {
    for (const riskTolerance of ["moderate", "high"] as const) {
      const input = structuredClone(f01);
      input.constraints.riskTolerance = riskTolerance;
      const result = compare(input);
      expect(result.preferredScenarioId).toBe("alternative-b");
      expect(
        result.feasibility.every((f) => f.eligibility === "conditional"),
      ).toBe(true);
    }
    const input = structuredClone(f01);
    input.constraints.riskTolerance = "low";
    expect(compare(input).conclusion).toBe("insufficient_evidence");
  });
  it("lets a documented prohibition override the largest NOI at every tolerance", () => {
    for (const riskTolerance of ["moderate", "high"] as const) {
      const scenarios = scenarioSet(),
        constraints = constraintsFor();
      constraints.riskTolerance = riskTolerance;
      const p = documented("legal", scenarios[2].proposedUse, "excluded");
      const result = compareScenarios(
        scenarios,
        calculateFinancials(scenarios),
        constraints,
        p,
        1,
      );
      expect(result.preferredScenarioId).toBe("alternative-a");
      expect(result.feasibility[2].eligibility).toBe("excluded");
      expect(
        result.reasons.some(
          (r) =>
            r.code === "LEGAL_EXCLUDED" &&
            r.evidenceIds.includes("synthetic-legal"),
        ),
      ).toBe(true);
    }
  });
  it("screens baseline legal status instead of assuming existing use is lawful", () => {
    const input = structuredClone(f01);
    input.constraints.maxInitialInvestment.value = "1";
    const scenarios = scenarioSet(input);
    const p = documented("legal", scenarios[0].proposedUse, "excluded");
    const result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(input),
      p,
      1,
    );
    expect(result.preferredScenarioId).toBeNull();
    expect(result.feasibility[0].eligibility).toBe("excluded");
  });
  it("does not accept model assertions as authoritative legal evidence", () => {
    const p = documented("legal", "Studio lease", "supported");
    p.evidence.find((e) => e.id === "synthetic-legal")!.provider = "model";
    const input = structuredClone(f01);
    input.constraints.riskTolerance = "low";
    const scenarios = scenarioSet(input);
    const result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(input),
      p,
      1,
    );
    expect(result.preferredScenarioId).toBeNull();
    expect(
      result.feasibility[2].checks.some((c) => c.code === "LEGAL_UNVERIFIED"),
    ).toBe(true);
  });
  it("keeps missing financial data in a potentially better candidate from producing a winner", () => {
    const scenarios = scenarioSet();
    if (scenarios[2].operatingExpenses.mode !== "total") throw Error("fixture");
    setValue(scenarios[2].operatingExpenses.annualAmount, null);
    const result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(),
      property,
      1,
    );
    expect(result.preferredScenarioId).toBeNull();
    expect(result.feasibility[2].eligibility).toBe("insufficient_data");
    expect(
      result.missingInputs.some((p) => p.startsWith("alternative-b.noi")),
    ).toBe(true);
    expect(result.rankedScenarioIds).toEqual(["alternative-a"]);
  });
  it("gives known exclusion precedence over missing financial inputs", () => {
    const scenarios = scenarioSet();
    if (scenarios[2].operatingExpenses.mode !== "total") throw Error("fixture");
    setValue(scenarios[2].operatingExpenses.annualAmount, null);
    const p = documented("physical", scenarios[2].proposedUse, "excluded");
    const result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(),
      p,
      1,
    );
    expect(result.preferredScenarioId).toBe("alternative-a");
    expect(result.feasibility[2].eligibility).toBe("excluded");
  });
  it("blocks a material physical prerequisite at all tolerances until evidence supports it", () => {
    for (const riskTolerance of ["moderate", "high"] as const) {
      const scenarios = scenarioSet(),
        constraints = constraintsFor();
      constraints.riskTolerance = riskTolerance;
      const result = compareScenarios(
        scenarios,
        calculateFinancials(scenarios),
        constraints,
        property,
        1,
        {
          prerequisites: [
            {
              scenarioId: "alternative-b",
              id: "utility-capacity",
              requirement:
                "The proposed conversion depends on verified utility capacity",
              status: "unverified",
              evidenceIds: [],
            },
          ],
        },
      );
      expect(result.preferredScenarioId).toBeNull();
      expect(result.feasibility[2].eligibility).toBe("insufficient_data");
      expect(
        result.missingInputs.some((p) => p.includes("utility-capacity")),
      ).toBe(true);
    }
  });
  it("does not equate a less-negative operating loss with feasibility", () => {
    const scenarios = scenarioSet();
    for (const [index, rent] of ["1", "2", "3"].entries())
      setValue(scenarios[index].annualRentPerSqft, rent);
    if (scenarios[0].operatingExpenses.mode !== "total") throw Error("fixture");
    setValue(scenarios[0].operatingExpenses.annualAmount, "100000");
    const results = calculateFinancials(scenarios);
    expect(new FinanceDecimal(results[1].incrementalNoi.value!).gt(0)).toBe(
      true,
    );
    const result = compareScenarios(
      scenarios,
      results,
      constraintsFor(),
      property,
      1,
    );
    expect(result.preferredScenarioId).toBeNull();
    expect(result.feasibility[1].eligibility).toBe("excluded");
  });
  it("does not claim a requested yield criterion when cost basis is absent", () => {
    const input = structuredClone(f01);
    input.constraints.minimumYieldOnCost.value = "0.05";
    const result = compare(input);
    expect(result.preferredScenarioId).toBeNull();
    expect(result.feasibility[1].eligibility).toBe("insufficient_data");
  });
  it("evaluates yield on cost only with a disclosed cost basis", () => {
    const input = structuredClone(f03);
    input.constraints.minimumYieldOnCost.value = "0.09";
    input.scenarios[2].totalProjectCost = {
      value: "2000000",
      note: "Includes existing asset and project costs",
    };
    expect(compare(input).preferredScenarioId).toBe("alternative-b");
  });
  it("does not let presentation rounding change ranking or eligibility", () => {
    const scenarios = scenarioSet();
    setValue(scenarios[1].annualRentPerSqft, "35");
    setValue(scenarios[1].occupancyRatio, "0.8");
    if (scenarios[1].operatingExpenses.mode !== "total") throw Error("fixture");
    setValue(scenarios[1].operatingExpenses.annualAmount, "85000.00000001");
    const result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(),
      property,
      1,
    );
    expect(result.rankedScenarioIds).toEqual([
      "alternative-b",
      "alternative-a",
    ]);
  });
  it("breaks true ties by lower investment and then stable scenario ID", () => {
    const scenarios = scenarioSet();
    scenarios[2] = { ...structuredClone(scenarios[1]), id: "alternative-b" };
    let result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(),
      property,
      1,
    );
    expect(result.rankedScenarioIds).toEqual([
      "alternative-a",
      "alternative-b",
    ]);
    setValue(scenarios[2].capex.renovation, "299999");
    result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(),
      property,
      1,
    );
    expect(result.rankedScenarioIds).toEqual([
      "alternative-b",
      "alternative-a",
    ]);
  });
  it("rejects impossible area and preserves known exclusions at high tolerance", () => {
    const scenarios = scenarioSet();
    setValue(scenarios[2].rentableAreaSqft, "13000");
    const result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(),
      property,
      1,
    );
    expect(result.preferredScenarioId).toBe("alternative-a");
    expect(result.feasibility[2].eligibility).toBe("excluded");
  });
  it("does not invent available rentable area from gross area", () => {
    const p = structuredClone(property);
    setValue(p.rentableAreaSqft, null);
    const scenarios = scenarioSet();
    scenarios.forEach((s) => {
      s.assumptions = [];
    });
    const result = compareScenarios(
      scenarios,
      calculateFinancials(scenarios),
      constraintsFor(),
      p,
      1,
    );
    expect(result.preferredScenarioId).toBeNull();
  });
  it("requires matching current results and echoes the input revision", () => {
    const scenarios = scenarioSet();
    const results = calculateFinancials(scenarios);
    expect(
      compareScenarios(scenarios, results, constraintsFor(), property, 42)
        .inputRevision,
    ).toBe(42);
    results[1].scenarioId = "other";
    expect(() =>
      compareScenarios(scenarios, results, constraintsFor(), property, 1),
    ).toThrow(/results/);
  });
});
