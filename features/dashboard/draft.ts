// Builds the minimal request the S06 spike sends. Only compatible sourced
// fields are copied; every unknown stays null and is never defaulted to zero.
// The full editor belongs to S13.
import type {
  AnalysisRequestDTO,
  PropertyDTO,
  ConstraintsInputDTO,
  ScenarioInputDTO,
} from "@/lib/contracts";

const unknown = { value: null } as const;

export function emptyConstraints(): ConstraintsInputDTO {
  return {
    maxInitialInvestment: { value: null },
    maxPaybackYears: { value: null },
    minimumYieldOnCost: { value: null },
    riskTolerance: "moderate",
    objective: "maximize_incremental_noi",
  };
}

export function baselineDraft(
  property: PropertyDTO,
  year: number,
): ScenarioInputDTO {
  return {
    id: "baseline",
    propertyId: property.id,
    role: "baseline",
    name: "Current use (baseline)",
    proposedUse: property.existingUse.value ?? "Existing use",
    leaseBasis: "unknown",
    rentNormalizationNote: null,
    period: {
      start: `${year}-01-01`,
      end: `${year + 1}-01-01`,
      basis: "stabilized_annual",
    },
    currency: "USD",
    // Gross area is intentionally never copied into rentable area.
    rentableAreaSqft: { value: property.rentableAreaSqft.value },
    annualRentPerSqft: { ...unknown },
    occupancyRatio: { value: property.occupancyRatio.value },
    collectionLossRatio: { ...unknown },
    annualConcessions: { ...unknown },
    otherPotentialAnnualIncome: { ...unknown },
    otherEffectiveAnnualIncome: { ...unknown },
    operatingExpenses: { mode: "total", annualAmount: { ...unknown } },
    capex: {
      renovation: { ...unknown },
      conversion: { ...unknown },
      softCosts: { ...unknown },
      contingency: { ...unknown },
      other: { ...unknown },
    },
    totalProjectCost: { ...unknown },
    assumptions: [],
  };
}

export function analysisRequest(
  property: PropertyDTO,
  inputRevision: number,
  year: number,
): AnalysisRequestDTO {
  return {
    contractVersion: "1",
    propertyId: property.id,
    inputRevision,
    action: "analyze",
    scenarios: [baselineDraft(property, year)],
    constraints: emptyConstraints(),
  };
}
