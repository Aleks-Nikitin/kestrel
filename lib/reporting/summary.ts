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
      evidenceIds: [],
      metricRefs: fields.map((field) => `${scenario.id}.${field}`),
      kind: "inference" as const,
    };
  });
  return InvestmentSummary.parse({
    preferredScenarioId: comparison.preferredScenarioId,
    headline: headline.slice(0, 2000),
    claims,
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
