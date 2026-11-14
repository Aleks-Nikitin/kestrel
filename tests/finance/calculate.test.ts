import { describe, expect, it } from "vitest";
import {
  calculateFinancials,
  DomainInputError,
  FinanceDecimal,
} from "@/lib/finance/calculate";
import { FinancialResult } from "@/lib/contracts";
import { f02, f03 } from "../fixtures/contracts";
import { scenarioSet, setValue } from "./helpers";
describe("annual Decimal financial engine", () => {
  it("matches F01 without presentation rounding", () => {
    const [base, a, b] = calculateFinancials(scenarioSet());
    expect([
      base.potentialGrossIncome.value,
      base.effectiveGrossIncome.value,
      base.noi.value,
    ]).toEqual(["200000", "180000", "120000"]);
    expect([a.noi.value, a.incrementalNoi.value, a.paybackYears.value]).toEqual(
      ["190000", "70000", "4.285714285714285714285714286"],
    );
    expect([b.noi.value, b.incrementalNoi.value, b.paybackYears.value]).toEqual(
      ["195000", "75000", "6"],
    );
    expect(base.paybackYears.unavailableReason).toBe("NOT_APPLICABLE");
    expect(
      [base, a, b].every((r) => FinancialResult.safeParse(r).success),
    ).toBe(true);
  });
  it("reconciles F02 waterfall with potential/effective other income kept distinct", () => {
    const r = calculateFinancials(scenarioSet(f02))[1];
    expect([
      r.potentialGrossIncome.value,
      r.vacancyLoss.value,
      r.collectionLoss.value,
      r.concessions.value,
      r.otherIncomeLoss.value,
      r.effectiveGrossIncome.value,
      r.noi.value,
    ]).toEqual([
      "306000",
      "30000",
      "5400",
      "10000",
      "1000",
      "259600",
      "179600",
    ]);
    const waterfall = new FinanceDecimal(r.potentialGrossIncome.value!)
      .minus(r.vacancyLoss.value!)
      .minus(r.collectionLoss.value!)
      .minus(r.concessions.value!)
      .minus(r.otherIncomeLoss.value!);
    expect(waterfall.toFixed()).toBe(r.effectiveGrossIncome.value);
  });
  it("calculates F03 YOC from disclosed total cost, never conversion budget", () => {
    expect(calculateFinancials(scenarioSet(f03))[1].yieldOnCost.value).toBe(
      "0.095",
    );
    expect(calculateFinancials(scenarioSet())[1].yieldOnCost.value).toBeNull();
  });
  it("preserves computable EGI/NOI when potential other income is unknown", () => {
    const scenarios = scenarioSet(f02);
    setValue(scenarios[1].otherPotentialAnnualIncome, null);
    const r = calculateFinancials(scenarios)[1];
    expect(r.potentialGrossIncome.value).toBeNull();
    expect(r.otherIncomeLoss.value).toBeNull();
    expect(r.effectiveGrossIncome.value).toBe("259600");
    expect(r.noi.value).toBe("179600");
  });
  it("does not turn missing effective other income into zero", () => {
    const scenarios = scenarioSet();
    setValue(scenarios[1].otherEffectiveAnnualIncome, null);
    const r = calculateFinancials(scenarios)[1];
    expect(r.potentialGrossIncome.value).toBe("300000");
    expect(r.effectiveGrossIncome.value).toBeNull();
    expect(r.noi.value).toBeNull();
  });
  it("does not turn missing total or empty itemized expenses into zero", () => {
    const scenarios = scenarioSet();
    scenarios[1].operatingExpenses = {
      mode: "total",
      annualAmount: {
        ...scenarios[1].capex.other,
        value: null,
        unit: "USD/year",
        origin: "unknown",
        evidenceIds: [],
        note: "Missing",
      },
    };
    scenarios[2].operatingExpenses = { mode: "itemized", items: [] };
    const results = calculateFinancials(scenarios);
    expect(results[1].noi.value).toBeNull();
    expect(results[2].noi.value).toBeNull();
    expect(results[1].potentialRent.value).toBe("300000");
  });
  it("makes complete itemized and explicit-total expense modes equivalent", () => {
    const scenarios = scenarioSet();
    const categories = [
      "taxes",
      "insurance",
      "management",
      "utilities",
      "maintenance",
      "other",
    ] as const;
    scenarios[1].operatingExpenses = {
      mode: "itemized",
      items: categories.map((category, index) => ({
        id: category,
        category,
        label: category,
        annualAmount: {
          ...scenarios[1].capex.other,
          unit: "USD/year",
          value: index === 0 ? "80000" : "0",
        },
      })),
    };
    expect(calculateFinancials(scenarios)[1].noi.value).toBe("190000");
  });
  it.each(["nnn", "unknown"] as const)(
    "does not silently normalize %s rent",
    (leaseBasis) => {
      const scenarios = scenarioSet();
      scenarios[1].leaseBasis = leaseBasis;
      const r = calculateFinancials(scenarios)[1];
      expect(r.noi.value).toBeNull();
      expect(r.noi.unavailableReason).toContain("LEASE_BASIS");
      expect(r.initialInvestment.value).toBe("300000");
    },
  );
  it("requires disclosed gross/modified-gross normalization and owner expenses", () => {
    const scenarios = scenarioSet();
    scenarios[1].rentNormalizationNote = null;
    expect(calculateFinancials(scenarios)[1].noi.value).toBeNull();
    scenarios[1].leaseBasis = "modified_gross";
    scenarios[1].rentNormalizationNote =
      "Owner-paid taxes, maintenance and insurance disclosed in total expenses";
    expect(calculateFinancials(scenarios)[1].noi.value).toBe("190000");
  });
  it("handles zero investment and zero/negative incremental NOI without infinity", () => {
    const scenarios = scenarioSet();
    setValue(scenarios[1].capex.renovation, "0");
    expect(calculateFinancials(scenarios)[1].paybackYears.value).toBe("0");
    setValue(scenarios[1].annualRentPerSqft, "20");
    setValue(
      scenarios[1].operatingExpenses.mode === "total"
        ? scenarios[1].operatingExpenses.annualAmount
        : scenarios[1].capex.other,
      "60000",
    );
    let r = calculateFinancials(scenarios)[1];
    expect(r.incrementalNoi.value).toBe("0");
    expect(r.paybackYears.value).toBeNull();
    expect(r.paybackYears.unavailableReason).toBe("NOT_ACHIEVED");
    setValue(scenarios[1].annualRentPerSqft, "10");
    r = calculateFinancials(scenarios)[1];
    expect(new FinanceDecimal(r.incrementalNoi.value!).isNegative()).toBe(true);
    expect(r.paybackYears.value).toBeNull();
  });
  it("supports negative NOI and negative YOC with a valid disclosed basis", () => {
    const scenarios = scenarioSet(f03);
    setValue(scenarios[1].annualRentPerSqft, "1");
    const r = calculateFinancials(scenarios)[1];
    expect(r.noi.value).toBe("-71000");
    expect(r.yieldOnCost.value).toBe("-0.0355");
  });
  it("keeps tiny ratios and large valid values in plain notation", () => {
    const scenarios = scenarioSet();
    setValue(scenarios[1].collectionLossRatio, "0.00000005");
    setValue(scenarios[1].annualRentPerSqft, "999999999999.99");
    const r = calculateFinancials(scenarios)[1];
    expect(r.collectionLoss.value).not.toContain("e");
    expect(r.potentialRent.value).toBe("9999999999999900");
    expect(r.collectionLoss.value).toBe("449999999.9999955");
  });
  it("rejects rates, oversized values, mixed periods and baseline project investment", () => {
    for (const change of [
      () => {
        const s = scenarioSet();
        setValue(s[1].occupancyRatio, "1.1");
        return s;
      },
      () => {
        const s = scenarioSet();
        setValue(s[1].annualRentPerSqft, "1000000000000");
        return s;
      },
      () => {
        const s = scenarioSet();
        s[1].period = {
          ...s[1].period,
          start: "2027-01-01",
          end: "2028-01-01",
        };
        return s;
      },
      () => {
        const s = scenarioSet();
        setValue(s[0].capex.renovation, "1");
        return s;
      },
    ])
      expect(() => calculateFinancials(change())).toThrow(DomainInputError);
  });
  it("rejects concessions above collected rent and incomplete project cost basis", () => {
    const scenarios = scenarioSet(f02);
    setValue(scenarios[1].annualConcessions, "270001");
    expect(() => calculateFinancials(scenarios)).toThrow(/Concessions/);
    const costs = scenarioSet(f03);
    setValue(costs[1].totalProjectCost, "299999");
    expect(() => calculateFinancials(costs)).toThrow(DomainInputError);
  });
  it("records formula IDs and relevant input references on every metric", () => {
    const r = calculateFinancials(scenarioSet())[1];
    expect(r.noi.formulaId).toBe("finance.v1.noi");
    expect(r.noi.inputPaths).toContain(
      "scenarios.alternative-a.operatingExpenses",
    );
    expect(r.noi.origin).toBe("derived_calculation");
  });
});
