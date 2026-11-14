import Decimal from "decimal.js";
import {
  FinancialResult,
  Scenario,
  type FinancialResultDTO,
  type ScenarioDTO,
} from "@/lib/contracts";

export const FinanceDecimal = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});
export class DomainInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainInputError";
  }
}
type D = Decimal;
type Metric = FinancialResultDTO["noi"];
type MetricName = Exclude<
  keyof FinancialResultDTO,
  "scenarioId" | "currency" | "period" | "calculationVersion" | "warnings"
>;
const moneyFields = new Set<MetricName>([
  "potentialRent",
  "potentialGrossIncome",
  "vacancyLoss",
  "collectionLoss",
  "concessions",
  "otherIncomeLoss",
  "effectiveGrossIncome",
  "operatingExpenses",
  "noi",
  "incrementalNoi",
]);
const amount = (value: string | null) =>
  value === null ? null : new FinanceDecimal(value);
function sum(values: (D | null)[]): D | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce<D>(
        (total, value) => total.plus(value!),
        new FinanceDecimal(0),
      );
}
function metric(
  scenarioId: string,
  name: MetricName,
  value: D | null,
  fields: string[],
  reason = "MISSING_INPUT",
): Metric {
  return {
    value: value === null ? null : value.toFixed(),
    unit: moneyFields.has(name)
      ? "USD/year"
      : name === "initialInvestment"
        ? "USD"
        : name === "paybackYears"
          ? "years"
          : "ratio",
    origin: "derived_calculation",
    formulaId: `finance.v1.${name}`,
    inputPaths: fields.map((field) => `scenarios.${scenarioId}.${field}`),
    unavailableReason: value === null ? reason : null,
  };
}
function operatingExpenses(scenario: ScenarioDTO): D | null {
  const expenses = scenario.operatingExpenses;
  if (expenses.mode === "total") return amount(expenses.annualAmount.value);
  if (new Set(expenses.items.map((item) => item.category)).size !== 6)
    return null;
  return sum(expenses.items.map((item) => amount(item.annualAmount.value)));
}
export function hasSupportedLeaseBasis(scenario: ScenarioDTO): boolean {
  return (
    (scenario.leaseBasis === "gross" ||
      scenario.leaseBasis === "modified_gross") &&
    !!scenario.rentNormalizationNote?.trim()
  );
}
/** Validates the shared accounting basis before any cross-scenario arithmetic. */
export function validateFinancialSet(scenarios: ScenarioDTO[]): void {
  if (
    !scenarios.length ||
    scenarios.length > 6 ||
    scenarios.filter((s) => s.role === "baseline").length !== 1 ||
    new Set(scenarios.map((s) => s.id)).size !== scenarios.length
  ) {
    throw new DomainInputError(
      "INVALID_SCENARIO_SET",
      "Exactly one baseline and unique scenario identifiers are required.",
    );
  }
  const first = scenarios[0];
  for (const scenario of scenarios) {
    if (!Scenario.safeParse(scenario).success)
      throw new DomainInputError(
        "INVALID_SCENARIO",
        "A scenario violates the validated annual financial contract.",
      );
    if (
      scenario.propertyId !== first.propertyId ||
      scenario.currency !== first.currency ||
      scenario.period.start !== first.period.start ||
      scenario.period.end !== first.period.end
    ) {
      throw new DomainInputError(
        "INCOMPATIBLE_BASIS",
        "Scenarios must use the same property, currency and annual period.",
      );
    }
  }
}
/** Canonical annual calculations. No financial value passes through Number arithmetic. */
export function calculateFinancials(
  scenarios: ScenarioDTO[],
): FinancialResultDTO[] {
  validateFinancialSet(scenarios);
  const intermediate = scenarios.map((scenario) => {
    const values = {
      area: amount(scenario.rentableAreaSqft.value),
      rent: amount(scenario.annualRentPerSqft.value),
      occupancy: amount(scenario.occupancyRatio.value),
      collection: amount(scenario.collectionLossRatio.value),
      concessions: amount(scenario.annualConcessions.value),
      potentialOther: amount(scenario.otherPotentialAnnualIncome.value),
      effectiveOther: amount(scenario.otherEffectiveAnnualIncome.value),
    };
    const supportedLease = hasSupportedLeaseBasis(scenario);
    const potentialRent =
      supportedLease && values.area !== null && values.rent !== null
        ? values.area.times(values.rent)
        : null;
    const occupied =
      potentialRent !== null && values.occupancy !== null
        ? potentialRent.times(values.occupancy)
        : null;
    const collectionLoss =
      occupied !== null && values.collection !== null
        ? occupied.times(values.collection)
        : null;
    if (
      occupied !== null &&
      collectionLoss !== null &&
      values.concessions !== null &&
      values.concessions.gt(occupied.minus(collectionLoss))
    ) {
      throw new DomainInputError(
        "EXCESS_CONCESSIONS",
        "Concessions cannot exceed modeled collected rent.",
      );
    }
    const pgi =
      potentialRent !== null && values.potentialOther !== null
        ? potentialRent.plus(values.potentialOther)
        : null;
    const vacancyLoss =
      potentialRent !== null && values.occupancy !== null
        ? potentialRent.times(new FinanceDecimal(1).minus(values.occupancy))
        : null;
    const otherLoss =
      values.potentialOther !== null && values.effectiveOther !== null
        ? values.potentialOther.minus(values.effectiveOther)
        : null;
    const egi =
      occupied !== null &&
      collectionLoss !== null &&
      values.concessions !== null &&
      values.effectiveOther !== null
        ? occupied
            .minus(collectionLoss)
            .minus(values.concessions)
            .plus(values.effectiveOther)
        : null;
    const expenses = operatingExpenses(scenario);
    const noi = egi !== null && expenses !== null ? egi.minus(expenses) : null;
    const investment = sum(
      Object.values(scenario.capex).map((datum) => amount(datum.value)),
    );
    const cost = amount(scenario.totalProjectCost.value);
    if (cost !== null && investment !== null && cost.lt(investment))
      throw new DomainInputError(
        "INCOMPLETE_COST_BASIS",
        "Total project cost must include initial investment.",
      );
    const yoc =
      noi !== null &&
      cost !== null &&
      cost.gt(0) &&
      investment !== null &&
      !!scenario.totalProjectCost.note?.trim()
        ? noi.div(cost)
        : null;
    return {
      scenario,
      supportedLease,
      potentialRent,
      occupied,
      pgi,
      vacancyLoss,
      collectionLoss,
      otherLoss,
      egi,
      expenses,
      noi,
      investment,
      yoc,
    };
  });
  const baseline = intermediate.find(
    (result) => result.scenario.role === "baseline",
  )!;
  return intermediate.map((result) => {
    const { scenario: s } = result;
    const delta =
      s.role === "baseline"
        ? new FinanceDecimal(0)
        : result.noi !== null && baseline.noi !== null
          ? result.noi.minus(baseline.noi)
          : null;
    const payback =
      s.role === "alternative" &&
      delta !== null &&
      delta.gt(0) &&
      result.investment !== null
        ? result.investment.div(delta)
        : null;
    const incomeReason = result.supportedLease
      ? "MISSING_INPUT"
      : "UNSUPPORTED_OR_UNDISCLOSED_LEASE_BASIS";
    const m = (
      name: MetricName,
      value: D | null,
      fields: string[],
      reason?: string,
    ) => metric(s.id, name, value, fields, reason);
    return FinancialResult.parse({
      scenarioId: s.id,
      currency: "USD",
      period: s.period,
      calculationVersion: "1",
      potentialRent: m(
        "potentialRent",
        result.potentialRent,
        ["rentableAreaSqft", "annualRentPerSqft", "leaseBasis"],
        incomeReason,
      ),
      potentialGrossIncome: m(
        "potentialGrossIncome",
        result.pgi,
        ["rentableAreaSqft", "annualRentPerSqft", "otherPotentialAnnualIncome"],
        incomeReason,
      ),
      vacancyLoss: m(
        "vacancyLoss",
        result.vacancyLoss,
        ["rentableAreaSqft", "annualRentPerSqft", "occupancyRatio"],
        incomeReason,
      ),
      collectionLoss: m(
        "collectionLoss",
        result.collectionLoss,
        [
          "rentableAreaSqft",
          "annualRentPerSqft",
          "occupancyRatio",
          "collectionLossRatio",
        ],
        incomeReason,
      ),
      concessions: m("concessions", amount(s.annualConcessions.value), [
        "annualConcessions",
      ]),
      otherIncomeLoss: m("otherIncomeLoss", result.otherLoss, [
        "otherPotentialAnnualIncome",
        "otherEffectiveAnnualIncome",
      ]),
      effectiveGrossIncome: m(
        "effectiveGrossIncome",
        result.egi,
        [
          "rentableAreaSqft",
          "annualRentPerSqft",
          "occupancyRatio",
          "collectionLossRatio",
          "annualConcessions",
          "otherEffectiveAnnualIncome",
        ],
        incomeReason,
      ),
      operatingExpenses: m(
        "operatingExpenses",
        result.expenses,
        ["operatingExpenses"],
        "MISSING_OR_INCOMPLETE_EXPENSES",
      ),
      noi: m(
        "noi",
        result.noi,
        [
          "rentableAreaSqft",
          "annualRentPerSqft",
          "occupancyRatio",
          "collectionLossRatio",
          "annualConcessions",
          "otherEffectiveAnnualIncome",
          "operatingExpenses",
        ],
        result.supportedLease ? "MISSING_INCOME_OR_EXPENSES" : incomeReason,
      ),
      initialInvestment: m(
        "initialInvestment",
        result.investment,
        Object.keys(s.capex).map((key) => `capex.${key}`),
      ),
      incrementalNoi: m(
        "incrementalNoi",
        delta,
        ["noi", `${baseline.scenario.id}.noi`],
        "MISSING_SCENARIO_OR_BASELINE_NOI",
      ),
      paybackYears: m(
        "paybackYears",
        payback,
        ["initialInvestment", "incrementalNoi"],
        s.role === "baseline"
          ? "NOT_APPLICABLE"
          : delta !== null && delta.lte(0)
            ? "NOT_ACHIEVED"
            : "MISSING_INVESTMENT_OR_INCREMENTAL_NOI",
      ),
      yieldOnCost: m(
        "yieldOnCost",
        result.yoc,
        ["noi", "totalProjectCost", "capex"],
        "MISSING_OR_UNDISCLOSED_TOTAL_PROJECT_COST",
      ),
      warnings: [
        "Annual unlevered screening excludes financing, depreciation, transaction costs, downtime and lease-up timing.",
        "Collection loss is applied to occupied scheduled rent before concessions.",
        "Do not count the same work in both renovation and conversion capital.",
        ...(!result.supportedLease
          ? [
              "Normalize the lease to a disclosed gross or modified-gross basis with owner-paid expenses before calculating income.",
            ]
          : []),
      ],
    });
  });
}
