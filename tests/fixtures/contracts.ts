import type { z } from "zod";
import {
  ComparisonRequest,
  ComparisonResponse,
  AnalysisResponse,
  Property,
  SpatialContext,
  type ScenarioInputDTO,
  type ScenarioDTO,
  type FinancialResultDTO,
  type ConstraintsInputDTO,
} from "@/lib/contracts";
export const timestamp = "2026-11-14T17:00:00Z";
export const propertyId = "synthetic-commercial-001";
const evidence = [
  {
    id: "synthetic-assumption",
    provider: "user",
    recordId: null,
    propertyId,
    kind: "assumption",
    label: "Fictional development fixture; all values are explicit estimates",
    retrievedAt: timestamp,
    sourceAsOf: null,
    sourceUrl: null,
    synthetic: true,
    parentEvidenceIds: [],
    allowedUse: { display: true, modelProcessing: true, export: true },
  },
] as const;
function d<T>(value: T | null, unit: string) {
  return {
    value,
    unit,
    origin: value === null ? "unknown" : "explicit_estimate",
    evidenceIds: value === null ? [] : ["synthetic-assumption"],
    recordedAt: timestamp,
    sourceAsOf: null,
    note:
      value === null
        ? "Not supplied in fictional fixture"
        : "Fictional explicit estimate for testing",
  };
}
export const property = Property.parse({
  id: propertyId,
  address: d("100 Fictional Example Way, Imaginary City", "text"),
  location: d({ longitude: -95.36, latitude: 29.76 }, "WGS84"),
  propertyType: d("Commercial", "text"),
  existingUse: d("Office", "text"),
  grossAreaSqft: d("12000", "sqft"),
  rentableAreaSqft: d("10000", "sqft"),
  yearBuilt: d(null, "count"),
  floors: d(1, "count"),
  occupancyRatio: d("0.9", "ratio"),
  marketRentAnnualPerSqft: d("20", "USD/sqft/year"),
  marketDescription: d(null, "text"),
  documentedConstraints: [],
  evidence,
  dataMode: "synthetic",
});
export const spatial = SpatialContext.parse({
  propertyId,
  provider: "matterport",
  dataMode: "synthetic",
  match: {
    status: "verified",
    method: "provider_link",
    evidenceIds: ["synthetic-assumption"],
    reviewedAt: timestamp,
    explanation: "Fictional explicit-ID match for development only",
  },
  imagery: null,
  observations: [
    {
      id: "synthetic-room",
      statement:
        "Fictional room dimensions support an area investigation, not structural approval",
      origin: "explicit_estimate",
      evidenceIds: ["synthetic-assumption"],
      limitations: ["Synthetic dimensions are not real building measurements"],
    },
  ],
  model: {
    id: "synthetic-model-001",
    joinSource: "costar_property_id",
    commercialPropertyId: propertyId,
    dimensionsUnit: "m",
    areaUnit: "m2",
    rooms: [
      { id: "room-001", width: "10", depth: "8", height: "3", floorArea: "80" },
    ],
    conversionNote: "1 m2 = 10.763910416709722 sqft; dimensions are estimates",
    signedUrlExpiresAt: null,
  },
  evidence,
  unavailableReason: null,
});
const value = (v: string | null) => ({
  value: v,
  acceptedEstimate: true,
  note: "Deliberate fictional assumption; owner-paid costs on gross lease basis",
});
function scenario(
  id: string,
  role: "baseline" | "alternative",
  rent: string,
  occupancy: string,
  expenses: string,
  investment: string,
): ScenarioInputDTO {
  return {
    id,
    propertyId,
    role,
    name: id,
    proposedUse:
      role === "baseline"
        ? "Office"
        : id === "alternative-a"
          ? "Retail lease"
          : "Studio lease",
    leaseBasis: "gross",
    rentNormalizationNote: "Annual gross rent, owner-paid expenses",
    period: {
      start: "2026-01-01",
      end: "2027-01-01",
      basis: "stabilized_annual",
    },
    currency: "USD",
    rentableAreaSqft: value("10000"),
    annualRentPerSqft: value(rent),
    occupancyRatio: value(occupancy),
    collectionLossRatio: value("0"),
    annualConcessions: value("0"),
    otherPotentialAnnualIncome: value("0"),
    otherEffectiveAnnualIncome: value("0"),
    operatingExpenses: { mode: "total", annualAmount: value(expenses) },
    capex: {
      renovation: value(investment),
      conversion: value("0"),
      softCosts: value("0"),
      contingency: value("0"),
      other: value("0"),
    },
    totalProjectCost: value(null),
    assumptions: [
      "Synthetic test assumptions; zoning and structural suitability unverified",
    ],
  };
}
export const constraints: ConstraintsInputDTO = {
  maxInitialInvestment: value("500000"),
  maxPaybackYears: value(null),
  minimumYieldOnCost: value(null),
  riskTolerance: "moderate",
  objective: "maximize_incremental_noi",
};
export const f01 = ComparisonRequest.parse({
  contractVersion: "1",
  propertyId,
  inputRevision: 1,
  scenarios: [
    scenario("baseline", "baseline", "20", "0.9", "60000", "0"),
    scenario("alternative-a", "alternative", "30", "0.9", "80000", "300000"),
    scenario("alternative-b", "alternative", "35", "0.8", "85000", "450000"),
  ],
  constraints,
});
export const revisedBudget = structuredClone(f01);
revisedBudget.inputRevision = 2;
revisedBudget.constraints.maxInitialInvestment.value = "350000";
export const f02 = structuredClone(f01);
Object.assign(f02.scenarios[1], {
  collectionLossRatio: value("0.02"),
  annualConcessions: value("10000"),
  otherPotentialAnnualIncome: value("6000"),
  otherEffectiveAnnualIncome: value("5000"),
});
export const f03 = structuredClone(f01);
f03.scenarios[1].totalProjectCost = {
  value: "2000000",
  note: "Includes existing asset basis and all project costs",
};
export const f04 = structuredClone(f01);
f04.constraints.maxPaybackYears.value = "5";
export const f04Edited = structuredClone(f04);
f04Edited.inputRevision = 2;
f04Edited.scenarios[2].occupancyRatio.value = "0.9";
export const missingInputs = structuredClone(f01);
missingInputs.scenarios[0].annualRentPerSqft.value = null;
missingInputs.scenarios[0].operatingExpenses = {
  mode: "total",
  annualAmount: value(null),
};
export const originForgery = {
  ...structuredClone(f01),
  scenarios: f01.scenarios.map((s) => ({
    ...s,
    rentableAreaSqft: {
      ...s.rentableAreaSqft,
      origin: "source_data",
      evidenceIds: ["forged"],
    },
  })),
};
export function canonicalScenario(s: ScenarioInputDTO): ScenarioDTO {
  function normalize(v: unknown, key: string): unknown {
    if (Array.isArray(v)) return v.map((x) => normalize(x, key));
    if (v && typeof v === "object") {
      if ("value" in v) {
        const units: Record<string, string> = {
          rentableAreaSqft: "sqft",
          annualRentPerSqft: "USD/sqft/year",
          occupancyRatio: "ratio",
          collectionLossRatio: "ratio",
          annualConcessions: "USD/year",
          otherPotentialAnnualIncome: "USD/year",
          otherEffectiveAnnualIncome: "USD/year",
          annualAmount: "USD/year",
          totalProjectCost: "USD",
        };
        return d(v.value, units[key] ?? "USD");
      }
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, normalize(x, k)]),
      );
    }
    return v;
  }
  return normalize(s, "") as ScenarioDTO;
}
function metric(value: string | null, field: string, unit = "USD/year") {
  return {
    value,
    unit,
    origin: "derived_calculation" as const,
    formulaId: `finance.v1.${field}`,
    inputPaths: ["scenarios"],
    unavailableReason:
      value === null ? "NOT_APPLICABLE_OR_MISSING_COST_BASIS" : null,
  };
}
function result(
  id: string,
  pgi: string,
  vacancy: string,
  egi: string,
  expense: string,
  noi: string,
  investment: string,
  delta: string,
  payback: string | null,
): FinancialResultDTO {
  return {
    scenarioId: id,
    currency: "USD",
    period: f01.scenarios[0].period,
    calculationVersion: "1",
    potentialRent: metric(pgi, "potentialRent"),
    potentialGrossIncome: metric(pgi, "potentialGrossIncome"),
    vacancyLoss: metric(vacancy, "vacancyLoss"),
    collectionLoss: metric("0", "collectionLoss"),
    concessions: metric("0", "concessions"),
    otherIncomeLoss: metric("0", "otherIncomeLoss"),
    effectiveGrossIncome: metric(egi, "effectiveGrossIncome"),
    operatingExpenses: metric(expense, "operatingExpenses"),
    noi: metric(noi, "noi"),
    initialInvestment: metric(investment, "initialInvestment", "USD"),
    incrementalNoi: metric(delta, "incrementalNoi"),
    paybackYears: metric(payback, "paybackYears", "years"),
    yieldOnCost: metric(null, "yieldOnCost", "ratio"),
    warnings: ["Synthetic; legal feasibility unverified"],
  } as FinancialResultDTO;
}
export const comparison = ComparisonResponse.parse({
  contractVersion: "1",
  propertyId,
  inputRevision: 1,
  scenarios: f01.scenarios.map(canonicalScenario),
  evidence,
  comparison: {
    policyVersion: "1",
    inputRevision: 1,
    results: [
      result(
        "baseline",
        "200000",
        "20000",
        "180000",
        "60000",
        "120000",
        "0",
        "0",
        null,
      ),
      result(
        "alternative-a",
        "300000",
        "30000",
        "270000",
        "80000",
        "190000",
        "300000",
        "70000",
        "4.285714285714285714285714286",
      ),
      result(
        "alternative-b",
        "350000",
        "70000",
        "280000",
        "85000",
        "195000",
        "450000",
        "75000",
        "6",
      ),
    ],
    feasibility: f01.scenarios.map((s) => ({
      scenarioId: s.id,
      checks: [
        {
          dimension: "legal",
          status: "unverified",
          code: "LEGAL_UNVERIFIED",
          explanation: "No authoritative legal evidence supplied",
          evidenceIds: [],
        },
      ],
      eligibility: "conditional",
      productivity: {
        status: "not_established",
        explanation:
          "Annual-income screening does not establish maximum productivity",
      },
    })),
    rankedScenarioIds: ["alternative-b", "alternative-a"],
    preferredScenarioId: "alternative-b",
    conclusion: "conditional_preference",
    reasons: [
      {
        code: "INCOME_WITHIN_BUDGET",
        scenarioIds: ["alternative-b"],
        evidenceIds: ["synthetic-assumption"],
        text: "Conditional income preference within budget; investment return not established. B requires $150,000 more for $5,000 more annual NOI.",
      },
    ],
    missingInputs: [],
  },
});
export const analysis = AnalysisResponse.parse({
  contractVersion: "1",
  status: "complete",
  property,
  spatial,
  scenarios: comparison.scenarios,
  comparison: comparison.comparison,
  summary: {
    preferredScenarioId: "alternative-b",
    headline: "Conditional synthetic income preference within budget",
    claims: [
      {
        text: "Synthetic B NOI is $195,000",
        evidenceIds: ["synthetic-assumption"],
        metricRefs: ["alternative-b.noi"],
        kind: "inference",
      },
    ],
    limitations: [
      "Fictional data",
      "Legal feasibility unverified",
      "No formal valuation",
    ],
    nextSteps: ["Verify permitted use and physical prerequisites"],
    generatedAt: timestamp,
  },
  inputRevision: 1,
  evidence,
  modelUsage: {
    provider: "gemini",
    modelId: "synthetic-gemini",
    fallbackUsed: false,
    attempts: 1,
  },
  execution: {
    requestId: "synthetic-run",
    completedTools: [
      {
        toolCallId: "synthetic-call",
        name: "runComparison",
        evidenceIds: ["synthetic-assumption"],
      },
    ],
    modelId: "synthetic-gemini",
    elapsedMs: 100,
    dataMode: "synthetic",
    sources: { propertyMode: "synthetic", spatialMode: "synthetic" },
  },
});
export const fallbackAnalysis = structuredClone(analysis);
if (fallbackAnalysis.status === "complete") {
  fallbackAnalysis.modelUsage = {
    provider: "openrouter",
    modelId: "synthetic-fallback",
    fallbackUsed: true,
    attempts: 3,
  };
  fallbackAnalysis.execution.modelId = "synthetic-fallback";
}
export const needsInput = AnalysisResponse.parse({
  contractVersion: "1",
  status: "needs_input",
  property,
  spatial,
  scenarios: missingInputs.scenarios.map(canonicalScenario),
  inputRevision: 1,
  evidence,
  missingInputs: [
    {
      path: "scenarios.0.annualRentPerSqft",
      reason: "Enter annual rent on a supported gross lease basis",
    },
    {
      path: "scenarios.0.operatingExpenses.annualAmount",
      reason: "Enter owner-paid annual operating expenses",
    },
  ],
});
export const missingImagery = SpatialContext.parse({
  ...spatial,
  dataMode: "unavailable",
  match: {
    ...spatial.match,
    status: "unmatched",
    evidenceIds: [],
    reviewedAt: null,
  },
  model: null,
  observations: [],
  unavailableReason: "Matching imagery unavailable",
});
export const mismatchedSpatial = SpatialContext.parse({
  ...missingImagery,
  match: {
    ...missingImagery.match,
    status: "ambiguous",
    explanation:
      "Conflicting building identifier; dependent observations removed",
  },
});
export const insufficientEvidence = ComparisonResponse.parse({
  ...comparison,
  comparison: {
    ...comparison.comparison,
    preferredScenarioId: null,
    conclusion: "insufficient_evidence",
    missingInputs: ["Critical structural prerequisite"],
  },
});
export const errors = Object.fromEntries(
  [
    "TIMEOUT",
    "RATE_LIMITED",
    "ANALYSIS_UNAVAILABLE",
    "DATA_MISMATCH",
    "LICENSE_RESTRICTED",
  ].map((code) => [
    code,
    {
      ok: false,
      error: {
        code,
        message: "Synthetic failure for development",
        retryable: ["TIMEOUT", "RATE_LIMITED", "ANALYSIS_UNAVAILABLE"].includes(
          code,
        ),
        requestId: "synthetic-error",
      },
    },
  ]),
);
export const success = <T>(data: T) => ({
  ok: true as const,
  data,
  requestId: "synthetic-request",
});
export type SyntheticComparison = z.infer<typeof ComparisonResponse>;

// Expected numbers are fixture assertions, never evidence of an executed engine.
export const expectedFinancials = {
  F01: {
    baselineNoi: "120000",
    alternativeANoi: "190000",
    alternativeBNoi: "195000",
    alternativeADelta: "70000",
    alternativeBDelta: "75000",
    alternativeAPayback: "4.285714285714285714285714286",
    alternativeBPayback: "6",
  },
  F02: {
    pgi: "306000",
    vacancyLoss: "30000",
    collectionLoss: "5400",
    concessions: "10000",
    otherIncomeLoss: "1000",
    egi: "259600",
    noi: "179600",
  },
  F03: { yieldOnCost: "0.095", missingBasisYield: null },
  F04: {
    initialPreferred: "alternative-a",
    editedPreferred: "alternative-b",
    editedBNoi: "230000",
    editedBDelta: "110000",
    editedBPayback: "4.090909090909090909090909091",
    reducedBudgetPreferred: "alternative-a",
  },
} as const;
export const revisedComparison = ComparisonResponse.parse({
  ...comparison,
  inputRevision: 2,
  comparison: {
    ...comparison.comparison,
    inputRevision: 2,
    rankedScenarioIds: ["alternative-a"],
    preferredScenarioId: "alternative-a",
    feasibility: comparison.comparison.feasibility.map((f) =>
      f.scenarioId === "alternative-b"
        ? {
            ...f,
            eligibility: "excluded",
            checks: [
              ...f.checks,
              {
                dimension: "financial",
                status: "excluded",
                code: "OVER_BUDGET",
                explanation: "450000 exceeds revised 350000 budget",
                evidenceIds: [],
              },
            ],
          }
        : f,
    ),
    reasons: [
      {
        code: "BUDGET_CHANGED",
        scenarioIds: ["alternative-a", "alternative-b"],
        evidenceIds: [],
        text: "A becomes the conditional income preference because B exceeds the revised budget",
      },
    ],
  },
});
export const editedResubmission = { ...structuredClone(f01), inputRevision: 2 };
