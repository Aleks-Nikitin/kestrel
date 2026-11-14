import type { z } from "zod";
import {
  Comparison,
  Constraints,
  FinancialResult,
  Id,
  Property,
  type ConstraintsDTO,
  type FinancialResultDTO,
  type PropertyDTO,
  type ScenarioDTO,
} from "@/lib/contracts";
import {
  DomainInputError,
  FinanceDecimal,
  hasSupportedLeaseBasis,
  validateFinancialSet,
} from "@/lib/finance/calculate";

type ComparisonDTO = z.infer<typeof Comparison>;
type FeasibilityDTO = ComparisonDTO["feasibility"][number];
type Check = FeasibilityDTO["checks"][number];
export interface MaterialPrerequisite {
  scenarioId: string;
  id: string;
  requirement: string;
  status: "supported" | "excluded" | "unverified";
  evidenceIds: string[];
}
export interface FeasibilityContext {
  /** Server-reviewed prerequisites only; never accept these from client request provenance. */
  prerequisites?: MaterialPrerequisite[];
}
const d = (value: string) => new FinanceDecimal(value);
const normalizedUse = (value: string) => value.trim().toLowerCase();
function trustedEvidence(property: PropertyDTO, ids: string[]): boolean {
  return (
    ids.length > 0 &&
    ids.every((id) => {
      const evidence = property.evidence.find((e) => e.id === id);
      return (
        evidence &&
        (["costar", "matterport", "vexcel"].includes(evidence.provider) ||
          (evidence.provider === "user" && evidence.kind === "record"))
      );
    })
  );
}
function screenScenario(
  scenario: ScenarioDTO,
  result: FinancialResultDTO,
  constraints: ConstraintsDTO,
  property: PropertyDTO,
  context: FeasibilityContext,
): { feasibility: FeasibilityDTO; missing: string[] } {
  const checks: Check[] = [];
  const missing: string[] = [];
  let criticalMissing = false;
  const add = (
    dimension: Check["dimension"],
    status: Check["status"],
    code: string,
    explanation: string,
    evidenceIds: string[] = [],
  ) => checks.push({ dimension, status, code, explanation, evidenceIds });
  const unavailable = (path: string, reason: string) => {
    criticalMissing = true;
    missing.push(`${scenario.id}.${path}: ${reason}`);
  };
  const documented = property.documentedConstraints.filter(
    (c) =>
      c.appliesToUses.some(
        (use) => normalizedUse(use) === normalizedUse(scenario.proposedUse),
      ) && trustedEvidence(property, c.evidenceIds),
  );
  const legal = documented.filter((c) => c.dimension === "legal");
  if (!legal.length)
    add(
      "legal",
      "unverified",
      "LEGAL_UNVERIFIED",
      "Legal feasibility is unverified; confirm the proposed use with the relevant authority.",
    );
  for (const finding of documented)
    add(
      finding.dimension,
      finding.finding,
      `${finding.dimension.toUpperCase()}_${finding.finding.toUpperCase()}`,
      finding.explanation,
      finding.evidenceIds,
    );
  const area = scenario.rentableAreaSqft.value,
    gross = property.grossAreaSqft.value,
    available = property.rentableAreaSqft.value;
  const disclosedAreaAssumption =
    ["user_input", "explicit_estimate"].includes(
      scenario.rentableAreaSqft.origin,
    ) &&
    !!scenario.rentableAreaSqft.note?.trim() &&
    scenario.assumptions.length > 0;
  if (area === null) {
    add(
      "physical",
      "unverified",
      "RENTABLE_AREA_UNKNOWN",
      "A disclosed rentable area is required; gross area cannot be silently substituted.",
    );
    unavailable("rentableAreaSqft", "Rentable area is required.");
  } else if (gross !== null && d(area).gt(gross)) {
    add(
      "physical",
      "excluded",
      "AREA_EXCEEDS_GROSS",
      "Proposed rentable area exceeds the sourced gross building area.",
      property.grossAreaSqft.evidenceIds,
    );
  } else if (available === null || d(area).gt(available)) {
    if (disclosedAreaAssumption && gross !== null) {
      add(
        "physical",
        "unverified",
        "AREA_CONVERSION_ASSUMPTION",
        "Rentable area is an explicit conversion assumption within gross area; verify the usable layout and measurement basis.",
        scenario.rentableAreaSqft.evidenceIds,
      );
    } else {
      add(
        "physical",
        "unverified",
        "AVAILABLE_AREA_UNVERIFIED",
        "Verified rentable area or an explicit disclosed conversion assumption consistent with gross area is required.",
      );
      unavailable(
        "rentableAreaSqft",
        "Available rentable area is not established for this scenario.",
      );
    }
  } else {
    add(
      "physical",
      "supported",
      "AREA_WITHIN_RECORDED_RENTABLE",
      "Scenario area is within the recorded rentable-area bound; this establishes no structural or legal approval.",
      property.rentableAreaSqft.evidenceIds,
    );
  }
  // A layout investigation is ordinary uncertainty. Only an affirmative material
  // prerequisite supplied by trusted server context makes it a blocking dependency.
  add(
    "physical",
    "unverified",
    "LAYOUT_NOT_CERTIFIED",
    "Verify access, room layout, utilities and any use-specific physical prerequisites before investment. Room estimates do not certify suitability.",
  );
  for (const prerequisite of context.prerequisites?.filter(
    (p) => p.scenarioId === scenario.id,
  ) ?? []) {
    const status =
      prerequisite.status !== "unverified" &&
      trustedEvidence(property, prerequisite.evidenceIds)
        ? prerequisite.status
        : "unverified";
    add(
      "physical",
      status,
      `PREREQUISITE_${prerequisite.id}`,
      prerequisite.requirement,
      status === "unverified" ? [] : prerequisite.evidenceIds,
    );
    if (status === "unverified")
      unavailable(`prerequisites.${prerequisite.id}`, prerequisite.requirement);
  }
  if (!hasSupportedLeaseBasis(scenario)) {
    add(
      "financial",
      "unverified",
      "LEASE_BASIS_UNSUPPORTED",
      "Normalize rent and owner-paid expenses to a disclosed gross or modified-gross annual basis.",
    );
    unavailable("leaseBasis", "Supported lease normalization is required.");
  }
  const requiredMetrics: ("noi" | "initialInvestment" | "incrementalNoi")[] = [
    "noi",
    "initialInvestment",
  ];
  if (scenario.role === "alternative") requiredMetrics.push("incrementalNoi");
  for (const name of requiredMetrics) {
    if (result[name].value === null)
      unavailable(
        name,
        result[name].unavailableReason ??
          "Required financial result unavailable.",
      );
  }
  if (scenario.role === "alternative") {
    if (result.noi.value !== null && d(result.noi.value).lte(0))
      add(
        "financial",
        "excluded",
        "NONPOSITIVE_NOI",
        "An alternative needs positive total NOI; a smaller operating loss is not financially feasible.",
      );
    if (
      result.incrementalNoi.value !== null &&
      d(result.incrementalNoi.value).lte(0)
    )
      add(
        "financial",
        "excluded",
        "NO_POSITIVE_INCREMENTAL_NOI",
        "The alternative does not improve annual NOI over the baseline.",
      );
    const criteria = [
      {
        name: "maxInitialInvestment",
        metric: "initialInvestment",
        limit: constraints.maxInitialInvestment.value,
        minimum: false,
        text: "Initial investment exceeds the supplied capital budget.",
      },
      {
        name: "maxPaybackYears",
        metric: "paybackYears",
        limit: constraints.maxPaybackYears.value,
        minimum: false,
        text: "Simple payback exceeds the supplied limit.",
      },
      {
        name: "minimumYieldOnCost",
        metric: "yieldOnCost",
        limit: constraints.minimumYieldOnCost.value,
        minimum: true,
        text: "Yield on cost is below the supplied minimum.",
      },
    ] as const;
    for (const criterion of criteria) {
      if (criterion.limit === null) continue;
      const value = result[criterion.metric].value;
      if (value === null) {
        add(
          "financial",
          "unverified",
          `${criterion.name.toUpperCase()}_UNAVAILABLE`,
          `The requested ${criterion.name} criterion cannot be evaluated.`,
        );
        unavailable(criterion.metric, `Required by ${criterion.name}.`);
      } else {
        const failed = criterion.minimum
          ? d(value).lt(criterion.limit)
          : d(value).gt(criterion.limit);
        add(
          "financial",
          failed ? "excluded" : "supported",
          failed
            ? `${criterion.name.toUpperCase()}_FAILED`
            : `${criterion.name.toUpperCase()}_MET`,
          failed
            ? criterion.text
            : `The ${criterion.name} criterion is satisfied.`,
        );
      }
    }
  }
  if (!checks.some((c) => c.dimension === "financial"))
    add(
      "financial",
      criticalMissing ? "unverified" : "supported",
      criticalMissing
        ? "FINANCIAL_INPUTS_INCOMPLETE"
        : "ANNUAL_SCREEN_CALCULABLE",
      criticalMissing
        ? "Some required inputs remain unknown."
        : "The annual income screen is calculable; omitted investment effects remain limitations.",
    );
  const legalUnknown = !legal.length;
  if (legalUnknown && constraints.riskTolerance === "low") {
    unavailable(
      "legalFeasibility",
      "Low risk tolerance requires verified legal feasibility.",
    );
    add(
      "risk",
      "unverified",
      "LOW_TOLERANCE_LEGAL_UNKNOWN",
      "Low risk tolerance cannot accept an unresolved legal-use finding.",
    );
  } else
    add(
      "risk",
      legalUnknown ? "unverified" : "supported",
      legalUnknown ? "CONDITIONAL_LEGAL_INVESTIGATION" : "KNOWN_RULES_APPLIED",
      legalUnknown
        ? "Moderate/high tolerance permits conditional screening only; legal feasibility is unverified."
        : "Known constraints apply at every risk tolerance; no probability score is inferred.",
    );
  const excluded = checks.some((check) => check.status === "excluded");
  const eligibility = excluded
    ? "excluded"
    : criticalMissing
      ? "insufficient_data"
      : checks.some((check) => check.status === "unverified")
        ? "conditional"
        : "eligible";
  return {
    feasibility: {
      scenarioId: scenario.id,
      checks,
      eligibility,
      productivity: {
        status: "not_established",
        explanation:
          "Annual-income ordering does not establish maximally productive use or market value.",
      },
    },
    missing: excluded ? [] : missing,
  };
}
/** Transparent policy v1: deterministic results and trusted evidence only. */
export function compareScenarios(
  scenarios: ScenarioDTO[],
  results: FinancialResultDTO[],
  constraints: ConstraintsDTO,
  property: PropertyDTO,
  inputRevision: number,
  context: FeasibilityContext = {},
): ComparisonDTO {
  validateFinancialSet(scenarios);
  if (
    scenarios.length < 3 ||
    !Number.isInteger(inputRevision) ||
    inputRevision < 0 ||
    !Constraints.safeParse(constraints).success ||
    !Property.safeParse(property).success ||
    scenarios.some((s) => s.propertyId !== property.id)
  )
    throw new DomainInputError(
      "INVALID_COMPARISON",
      "Comparison requires a valid property, constraints and one baseline with at least two alternatives.",
    );
  if (
    results.length !== scenarios.length ||
    new Set(results.map((r) => r.scenarioId)).size !== scenarios.length ||
    results.some(
      (r) =>
        !FinancialResult.safeParse(r).success ||
        !scenarios.some(
          (s) =>
            s.id === r.scenarioId &&
            s.period.start === r.period.start &&
            s.period.end === r.period.end,
        ),
    )
  )
    throw new DomainInputError(
      "INVALID_RESULTS",
      "Financial results do not match the current scenarios and annual period.",
    );
  if (
    context.prerequisites?.some(
      (p) =>
        !scenarios.some((s) => s.id === p.scenarioId) ||
        !Id.safeParse(p.id).success ||
        !p.requirement.trim() ||
        p.requirement.length > 2000,
    )
  )
    throw new DomainInputError(
      "INVALID_PREREQUISITE",
      "Material prerequisites must identify a current scenario and a bounded rule.",
    );
  const screened = scenarios.map((scenario) =>
    screenScenario(
      scenario,
      results.find((r) => r.scenarioId === scenario.id)!,
      constraints,
      property,
      context,
    ),
  );
  const feasibility = screened.map((s) => s.feasibility);
  const missingInputs = screened.flatMap((s) => s.missing);
  const resultById = new Map(
    results.map((result) => [result.scenarioId, result]),
  );
  const alternatives = scenarios.filter((s) => s.role === "alternative");
  const candidates = alternatives.filter((s) =>
    ["eligible", "conditional"].includes(
      feasibility.find((f) => f.scenarioId === s.id)!.eligibility,
    ),
  );
  candidates.sort((a, b) => {
    const ar = resultById.get(a.id)!,
      br = resultById.get(b.id)!;
    return (
      d(br.incrementalNoi.value!).cmp(ar.incrementalNoi.value!) ||
      d(ar.initialInvestment.value!).cmp(br.initialInvestment.value!) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  });
  const reasons: ComparisonDTO["reasons"] = feasibility.flatMap((f) =>
    f.checks
      .filter((c) => c.status !== "supported")
      .map((c) => ({
        code: c.code,
        scenarioIds: [f.scenarioId],
        evidenceIds: c.evidenceIds,
        text: c.explanation,
      })),
  );
  const constrained = [
    constraints.maxInitialInvestment.value,
    constraints.maxPaybackYears.value,
    constraints.minimumYieldOnCost.value,
  ].some((value) => value !== null);
  if (!constrained) {
    missingInputs.push(
      "constraints: Supply a capital or return constraint before selecting a preferred alternative.",
    );
    reasons.push({
      code: "CAPITAL_OR_RETURN_CONSTRAINT_REQUIRED",
      scenarioIds: [],
      evidenceIds: [],
      text: "Financial ordering is shown, but no capital or return constraint was supplied.",
    });
  }
  const unresolved = feasibility.some(
    (f) => f.eligibility === "insufficient_data",
  );
  const baseline = scenarios.find((s) => s.role === "baseline")!;
  const baselineResult = resultById.get(baseline.id)!;
  const baselineFeasibility = feasibility.find(
    (f) => f.scenarioId === baseline.id,
  )!;
  let preferredScenarioId: string | null = null;
  let conclusion: ComparisonDTO["conclusion"] = "insufficient_evidence";
  if (constrained && !unresolved && candidates.length) {
    preferredScenarioId = candidates[0].id;
    conclusion = "conditional_preference";
    reasons.push({
      code: "CONSTRAINED_INCREMENTAL_NOI_PREFERENCE",
      scenarioIds: [preferredScenarioId],
      evidenceIds: [],
      text:
        constraints.maxPaybackYears.value === null &&
        constraints.minimumYieldOnCost.value === null
          ? "Conditional income preference within budget; investment return is not established."
          : "Conditional preference maximizes incremental annual NOI among alternatives satisfying the supplied constraints; this is not formal valuation.",
    });
  } else if (
    constrained &&
    !unresolved &&
    !candidates.length &&
    baselineResult.noi.value !== null &&
    d(baselineResult.noi.value).gt(0) &&
    baselineFeasibility.eligibility !== "excluded"
  ) {
    preferredScenarioId = baseline.id;
    conclusion = "retain_baseline";
    reasons.push({
      code: "RETAIN_BASELINE",
      scenarioIds: [baseline.id],
      evidenceIds: [],
      text: "No alternative satisfies the known financial and feasibility constraints; retain the positive-NOI baseline provisionally and investigate its unresolved conditions.",
    });
  }
  // Dominance is comparable only when legal/physical evidence and statuses agree.
  const evidenceSignature = (id: string) =>
    JSON.stringify(
      feasibility
        .find((f) => f.scenarioId === id)!
        .checks.filter(
          (c) => c.dimension === "legal" || c.dimension === "physical",
        )
        .map((c) => [c.dimension, c.status, [...c.evidenceIds].sort()])
        .sort(),
    );
  for (const candidate of candidates) {
    const r = resultById.get(candidate.id)!;
    const dominant = candidates.find((other) => {
      if (
        other.id === candidate.id ||
        evidenceSignature(other.id) !== evidenceSignature(candidate.id)
      )
        return false;
      const o = resultById.get(other.id)!;
      return (
        d(o.incrementalNoi.value!).gte(r.incrementalNoi.value!) &&
        d(o.initialInvestment.value!).lte(r.initialInvestment.value!) &&
        (d(o.incrementalNoi.value!).gt(r.incrementalNoi.value!) ||
          d(o.initialInvestment.value!).lt(r.initialInvestment.value!))
      );
    });
    if (dominant)
      reasons.push({
        code: "FINANCIALLY_DOMINATED",
        scenarioIds: [candidate.id, dominant.id],
        evidenceIds: [],
        text: "With comparable evidence and feasibility, another alternative has at least as much incremental NOI with no more initial investment.",
      });
  }
  return Comparison.parse({
    policyVersion: "1",
    inputRevision,
    results,
    feasibility,
    rankedScenarioIds: candidates.map((s) => s.id),
    preferredScenarioId,
    conclusion,
    reasons,
    missingInputs: [...new Set(missingInputs)],
  });
}
