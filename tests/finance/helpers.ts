import type {
  ComparisonRequestDTO,
  ConstraintsDTO,
  ScenarioDTO,
} from "@/lib/contracts";
import { canonicalScenario, f01 } from "../fixtures/contracts";
export function scenarioSet(input: ComparisonRequestDTO = f01): ScenarioDTO[] {
  return input.scenarios.map(canonicalScenario);
}
export function constraintsFor(
  input: ComparisonRequestDTO = f01,
): ConstraintsDTO {
  const template = scenarioSet(input)[0].capex.other;
  const field = <U extends "USD" | "years" | "ratio">(
    value: string | null,
    unit: U,
  ) => ({
    ...template,
    value,
    unit,
    origin:
      value === null ? ("unknown" as const) : ("explicit_estimate" as const),
    evidenceIds: value === null ? [] : template.evidenceIds,
    note:
      value === null
        ? "Constraint is unset"
        : "Deliberate synthetic constraint",
  });
  return {
    objective: "maximize_incremental_noi",
    riskTolerance: input.constraints.riskTolerance,
    maxInitialInvestment: field(
      input.constraints.maxInitialInvestment.value,
      "USD",
    ),
    maxPaybackYears: field(input.constraints.maxPaybackYears.value, "years"),
    minimumYieldOnCost: field(
      input.constraints.minimumYieldOnCost.value,
      "ratio",
    ),
  };
}
export function setValue(
  datum: {
    value: string | null;
    origin: string;
    evidenceIds: string[];
    note: string | null;
  },
  value: string | null,
) {
  datum.value = value;
  if (value === null) {
    datum.origin = "unknown";
    datum.evidenceIds = [];
    datum.note = "Not supplied in test";
  } else {
    datum.origin = "explicit_estimate";
    datum.note = "Deliberate synthetic test input";
  }
}
