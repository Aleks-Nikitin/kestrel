import {
  InvestmentSummary,
  type PropertyDTO,
  type SpatialContextDTO,
  type ComparisonResponseDTO,
} from "@/lib/contracts";
/** Template text is assembled from the canonical comparison, never LLM numbers. */
export function buildInvestmentSummary(input: {
  property: PropertyDTO;
  spatial: SpatialContextDTO;
  response: ComparisonResponseDTO;
  generatedAt?: string;
}) {
  const { response } = input;
  const comparison = response.comparison;
  const preferred = response.scenarios.find(
    (s) => s.id === comparison.preferredScenarioId,
  );
  const knownEvidence = new Set(response.evidence.map((e) => e.id));
  function inputEvidence(value: unknown): string[] {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap(inputEvidence);
    return Object.entries(value).flatMap(([key, child]) =>
      key === "evidenceIds" && Array.isArray(child)
        ? child.filter((id): id is string => typeof id === "string" && knownEvidence.has(id))
        : inputEvidence(child),
    );
  }
  const baseline = response.scenarios.find((s) => s.role === "baseline");
  const headline =
    comparison.conclusion === "insufficient_evidence"
      ? "More evidence is required before naming a preferred use"
      : comparison.conclusion === "retain_baseline"
        ? "Retain the baseline under the supplied screening constraints"
        : `Conditional annual-income preference: ${preferred?.name ?? "review candidate"}`;
  const claims = comparison.results.map((result) => {
    const scenario = response.scenarios.find(
      (s) => s.id === result.scenarioId,
    )!;
    const fields = [
      "potentialGrossIncome",
      "effectiveGrossIncome",
      "operatingExpenses",
      "noi",
      "incrementalNoi",
      "initialInvestment",
      "paybackYears",
      "yieldOnCost",
    ] as const;
    const labels = [
      "PGI USD/year",
      "EGI USD/year",
      "OpEx USD/year",
      "NOI USD/year",
      "incremental NOI USD/year",
      "initial investment USD",
      "simple payback years",
      "yield on cost ratio",
    ];
    return {
      text: `${scenario.name}: ${fields.map((field, i) => `${labels[i]} ${result[field].value ?? "unavailable"}`).join("; ")}.`.slice(
        0,
        2000,
      ),
      evidenceIds: [...new Set([...inputEvidence(scenario), ...inputEvidence(baseline)])],
      metricRefs: fields.map((field) => `${scenario.id}.${field}`),
      kind: "inference" as const,
    };
  });
  return InvestmentSummary.parse({
    preferredScenarioId: comparison.preferredScenarioId,
    headline: headline.slice(0, 2000),
    claims: [
      ...(input.property.rentableAreaSqft.value !== null && input.property.rentableAreaSqft.origin === "source_data" ? [{
        text: `The property record reports ${input.property.rentableAreaSqft.value} sqft of rentable area. Model room areas use a different measurement basis and do not replace this value.`,
        evidenceIds: input.property.rentableAreaSqft.evidenceIds,
        metricRefs: [],
        kind: "fact" as const,
      }] : []),
      ...input.spatial.observations.map((observation) => ({
        text: observation.statement,
        evidenceIds: observation.evidenceIds,
        metricRefs: [],
        kind: "inference" as const,
      })),
      ...claims,
    ],
    limitations: [
      "Preliminary stabilized annual USD screening, not an appraisal or a legal, structural or investment-return certification.",
      "Rent, expenses and conversion costs retain their disclosed source or user-assumption origins. Unknowns are not zeros.",
      "Simple payback is undiscounted; maximum property value and maximally productive use are not established.",
      ...comparison.reasons.map((r) => r.text),
      ...response.scenarios.flatMap((s) => s.assumptions),
    ]
      .slice(0, 30)
      .map((s) => s.slice(0, 2000)),
    nextSteps: [
      ...comparison.missingInputs.map(
        (path) => `Resolve missing input or evidence: ${path}`,
      ),
      "Confirm permitted use and any material physical conversion prerequisites with qualified reviewers.",
      "Validate rents, owner-paid expenses, capital scope, cost basis and the selected capital/return constraints.",
    ].slice(0, 30),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  });
}
