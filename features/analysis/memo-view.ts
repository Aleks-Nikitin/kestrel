// Presentation adapter for a completed analysis. Pure and immutable: it reads
// the response the API already returned and arranges it for an investor. It
// never calculates a financial value, rewrites a claim, or invents a verdict,
// rationale or step; every string shown comes from the response or from a
// fixed label for one of its enums. Exact values stay available for the audit.
import type { AnalysisResponseDTO, FinancialResultDTO } from "@/lib/contracts";
import { formatByUnit } from "@/features/dashboard/format";
import { describeMissing } from "@/features/scenarios/readiness";
import { providerKind, type ProvenanceKind } from "@/components/kestrel/provenance";
import type { AnalysisAction } from "./actions";

type Complete = Extract<AnalysisResponseDTO, { status: "complete" }>;
type Metric = FinancialResultDTO["noi"];
type Check = Complete["comparison"]["feasibility"][number]["checks"][number];

export type MemoSection = "ranking" | "financials" | "rationale" | "risks" | "evidence";

/** Each action returns the same result shape; the view only changes what leads. */
export const ACTION_FOCUS: Record<AnalysisAction, { title: string; note: string; order: MemoSection[] }> = {
  analyze: { title: "Full analysis", note: "The complete memo.", order: ["financials", "rationale", "risks", "evidence"] },
  compare: { title: "Comparison", note: "Leads with how the scenarios rank.", order: ["ranking", "financials", "rationale", "risks", "evidence"] },
  risks: { title: "Risks", note: "Leads with what could undermine the result.", order: ["risks", "financials", "rationale", "evidence"] },
  explain: { title: "Explanation", note: "Leads with why the comparison reached this result.", order: ["rationale", "financials", "risks", "evidence"] },
  summary: { title: "Summary", note: "The decision, its figures and the main risks.", order: ["financials", "risks", "rationale", "evidence"] },
  suggest_uses: { title: "Full analysis", note: "The complete memo.", order: ["financials", "rationale", "risks", "evidence"] },
};

export const CONCLUSION_LABEL: Record<Complete["comparison"]["conclusion"], string> = {
  conditional_preference: "Conditionally preferred",
  retain_baseline: "Retain the baseline",
  insufficient_evidence: "Insufficient evidence",
};
export const ELIGIBILITY_LABEL: Record<Complete["comparison"]["feasibility"][number]["eligibility"], string> = {
  eligible: "Within your limits",
  conditional: "Conditional on open checks",
  excluded: "Excluded by a limit or finding",
  insufficient_data: "Not enough data to screen",
};
export const DIMENSION_LABEL: Record<Check["dimension"], string> = {
  legal: "Legal",
  physical: "Physical",
  financial: "Financial",
  risk: "Risk",
};
export const STATUS_LABEL: Record<Check["status"], string> = {
  excluded: "Blocks this use",
  unverified: "Not yet verified",
  supported: "Supported",
};

/** A plain reading of the calculator's reason code. Unknown never becomes zero. */
export function friendlyUnavailable(reason: string | null, baseline: boolean): string {
  if (!reason) return "Unavailable";
  if (!/^[A-Z0-9_]+$/.test(reason)) return reason;
  if (reason === "NOT_APPLICABLE") return baseline ? "Not applicable to baseline" : "Not applicable";
  const known: Record<string, string> = {
    NOT_ACHIEVED: "Payback is not achieved with non-positive incremental NOI",
    MISSING_INPUT: "Required value not supplied",
    UNSUPPORTED_OR_UNDISCLOSED_LEASE_BASIS: "Needs a supported, disclosed lease basis",
    MISSING_OR_INCOMPLETE_EXPENSES: "Operating expense inputs are incomplete",
    MISSING_INCOME_OR_EXPENSES: "Income or expense inputs are incomplete",
    MISSING_SCENARIO_OR_BASELINE_NOI: "Needs scenario and baseline NOI",
    MISSING_INVESTMENT_OR_INCREMENTAL_NOI: "Needs investment and incremental NOI",
    MISSING_OR_UNDISCLOSED_TOTAL_PROJECT_COST: "Needs a disclosed cost basis",
  };
  return known[reason] ?? "Unavailable — review the reported reason in Technical audit";
}

export interface MemoMetric {
  key: string;
  label: string;
  /** Rounded for reading; null when the server reports it unavailable. */
  display: string | null;
  unavailable: string | null;
  /** The server's exact string, unit, formula and raw reason, for the audit. */
  exact: { value: string | null; unit: string; formulaId: string; reason: string | null };
}

const HIGHLIGHTS: [keyof FinancialResultDTO & string, string][] = [
  ["noi", "Annual NOI"],
  ["incrementalNoi", "Incremental NOI"],
  ["initialInvestment", "Initial investment"],
  ["paybackYears", "Simple payback"],
  ["yieldOnCost", "Yield on cost"],
];

function metricView(key: string, label: string, m: Metric, baseline: boolean): MemoMetric {
  return {
    key,
    label,
    display: m.value === null ? null : formatByUnit(m.value, m.unit),
    unavailable: m.value === null ? friendlyUnavailable(m.unavailableReason, baseline) : null,
    exact: { value: m.value, unit: m.unit, formulaId: m.formulaId, reason: m.unavailableReason },
  };
}

export interface MemoFinding {
  dimension: Check["dimension"];
  status: Check["status"];
  code: string;
  explanation: string;
  /** Every scenario the identical finding applies to. */
  scenarios: string[];
  evidenceIds: string[];
}
export interface MemoClaim {
  text: string;
  kind: "fact" | "assumption" | "inference";
  sources: ProvenanceKind[];
  synthetic: boolean;
  evidenceIds: string[];
  metricRefs: string[];
}
export interface MemoEvidenceGroup {
  kind: ProvenanceKind;
  count: number;
  synthetic: number;
  records: { id: string; label: string; kind: string; synthetic: boolean }[];
}
export interface MemoActivity {
  label: string;
  /** Actual executions grouped under this label; never deduplicated. */
  count: number;
}

export interface MemoView {
  focus: { action: AnalysisAction; title: string; note: string; order: MemoSection[] };
  decision: {
    conclusion: Complete["comparison"]["conclusion"];
    label: string;
    preferred: { id: string; name: string; proposedUse: string; eligibility: string } | null;
    headline: string;
  };
  /** Scenario the figures describe: the preferred one, else the baseline. */
  subject: { name: string; baseline: boolean };
  highlights: MemoMetric[];
  ranking: { id: string; name: string; rank: number | null; preferred: boolean; baseline: boolean; noi: MemoMetric; eligibility: string }[];
  rationale: { key: string; text: string; scenarios: string[] }[];
  findings: MemoFinding[];
  warnings: { text: string; scenarios: string[] }[];
  limitations: string[];
  missing: string[];
  nextSteps: string[];
  claims: { facts: MemoClaim[]; uncertain: MemoClaim[] };
  evidence: MemoEvidenceGroup[];
  activity: MemoActivity[];
  verification: Complete["execution"]["verification"] | null;
  sources: { property: string; spatial: string; combined: string; mixed: boolean; synthetic: boolean };
}

const STATUS_ORDER: Record<Check["status"], number> = { excluded: 0, unverified: 1, supported: 2 };
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** Plain words for what a reported tool did. The real names stay in the audit. */
export function activityLabel(toolName: string): string {
  if (toolName === "proposeScenarios") return "Validated the submitted scenarios";
  const n = toolName.toLowerCase();
  if (/todo|plan/.test(n)) return "Planned the investigation";
  if (/verif/.test(n)) return "Checked the submitted claims";
  if (/compar|financ|calculat|scenario/.test(n)) return "Calculated the scenario comparison";
  if (/spatial|matterport|room|tour/.test(n)) return "Retrieved spatial evidence";
  if (/propert|record|costar|catalog/.test(n)) return "Retrieved property context";
  return "Completed supporting steps";
}

export function buildMemoView(response: Complete, action: AnalysisAction | null): MemoView {
  const { comparison, summary, scenarios, evidence, execution } = response;
  const scenarioOf = new Map(scenarios.map((s) => [s.id, s]));
  const name = (id: string) => scenarioOf.get(id)?.name ?? id;
  const feasibility = new Map(comparison.feasibility.map((f) => [f.scenarioId, f]));
  const evidenceOf = new Map(evidence.map((e) => [e.id, e]));
  const focusAction = action ?? "analyze";
  const focus = ACTION_FOCUS[focusAction];

  const preferredId = comparison.preferredScenarioId;
  const preferred = preferredId ? scenarioOf.get(preferredId) : undefined;
  const baseline = scenarios.find((s) => s.role === "baseline");
  const subject = preferred ?? baseline ?? scenarios[0];
  const subjectResult = comparison.results.find((r) => r.scenarioId === subject.id) ?? comparison.results[0];
  const subjectIsBaseline = subject.role === "baseline";

  // Identical findings are shown once: same dimension, status, code and explanation.
  const findings = new Map<string, MemoFinding>();
  for (const f of comparison.feasibility)
    for (const c of f.checks) {
      const key = JSON.stringify([c.dimension, c.status, c.code, c.explanation]);
      const hit = findings.get(key);
      if (hit) {
        hit.scenarios = uniq([...hit.scenarios, name(f.scenarioId)]);
        hit.evidenceIds = uniq([...hit.evidenceIds, ...c.evidenceIds]);
      } else
        findings.set(key, {
          dimension: c.dimension,
          status: c.status,
          code: c.code,
          explanation: c.explanation,
          scenarios: [name(f.scenarioId)],
          evidenceIds: [...c.evidenceIds],
        });
    }

  const warnings = new Map<string, string[]>();
  for (const r of comparison.results)
    for (const w of r.warnings) warnings.set(w, uniq([...(warnings.get(w) ?? []), name(r.scenarioId)]));

  const rationale = new Map<string, { key: string; text: string; scenarios: string[] }>();
  comparison.reasons.forEach((r, i) => {
    const hit = rationale.get(r.text);
    const names = r.scenarioIds.map(name);
    if (hit) hit.scenarios = uniq([...hit.scenarios, ...names]);
    else rationale.set(r.text, { key: `${r.code}-${i}`, text: r.text, scenarios: names });
  });

  const claim = (c: Complete["summary"]["claims"][number]): MemoClaim => {
    const cited = c.evidenceIds.flatMap((id) => {
      const e = evidenceOf.get(id);
      return e ? [e] : [];
    });
    return {
      text: c.text,
      kind: c.kind,
      sources: uniq([...cited.map((e) => providerKind(e.provider)), ...(c.metricRefs.length ? (["calculation"] as ProvenanceKind[]) : [])]),
      synthetic: cited.some((e) => e.synthetic),
      evidenceIds: [...c.evidenceIds],
      metricRefs: [...c.metricRefs],
    };
  };

  const groups = new Map<ProvenanceKind, MemoEvidenceGroup>();
  for (const e of evidence) {
    const kind = providerKind(e.provider);
    const g = groups.get(kind) ?? { kind, count: 0, synthetic: 0, records: [] };
    g.count += 1;
    if (e.synthetic) g.synthetic += 1;
    g.records.push({ id: e.id, label: e.label, kind: e.kind, synthetic: e.synthetic });
    groups.set(kind, g);
  }

  const activity = new Map<string, number>();
  for (const t of execution.completedTools) {
    const label = activityLabel(t.name);
    activity.set(label, (activity.get(label) ?? 0) + 1);
  }

  return {
    focus: { action: focusAction, title: focus.title, note: focus.note, order: [...focus.order] },
    decision: {
      conclusion: comparison.conclusion,
      label: CONCLUSION_LABEL[comparison.conclusion],
      preferred: preferred
        ? {
            id: preferred.id,
            name: preferred.name,
            proposedUse: preferred.proposedUse,
            eligibility: ELIGIBILITY_LABEL[feasibility.get(preferred.id)?.eligibility ?? "insufficient_data"],
          }
        : null,
      headline: summary.headline,
    },
    subject: { name: subject.name, baseline: subjectIsBaseline },
    highlights: HIGHLIGHTS.map(([key, label]) => metricView(key, label, subjectResult[key as "noi"], subjectIsBaseline)),
    ranking: comparison.results.map((r) => {
      const s = scenarioOf.get(r.scenarioId);
      const rank = comparison.rankedScenarioIds.indexOf(r.scenarioId);
      return {
        id: r.scenarioId,
        name: name(r.scenarioId),
        rank: rank === -1 ? null : rank + 1,
        preferred: r.scenarioId === preferredId,
        baseline: s?.role === "baseline",
        noi: metricView("noi", "Annual NOI", r.noi, s?.role === "baseline"),
        eligibility: ELIGIBILITY_LABEL[feasibility.get(r.scenarioId)?.eligibility ?? "insufficient_data"],
      };
    }),
    rationale: [...rationale.values()],
    findings: [...findings.values()].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    warnings: [...warnings.entries()].map(([text, names]) => ({ text, scenarios: names })),
    limitations: uniq(summary.limitations),
    missing: comparison.missingInputs.map((m) => describeMissing(m, name)),
    nextSteps: uniq(summary.nextSteps),
    claims: {
      facts: summary.claims.filter((c) => c.kind === "fact").map(claim),
      uncertain: summary.claims.filter((c) => c.kind !== "fact").map(claim),
    },
    evidence: [...groups.values()],
    activity: [...activity.entries()].map(([label, count]) => ({ label, count })),
    verification: execution.verification ?? null,
    sources: {
      property: execution.sources.propertyMode,
      spatial: execution.sources.spatialMode,
      combined: execution.dataMode,
      mixed: execution.dataMode === "mixed",
      synthetic: evidence.some((e) => e.synthetic) || execution.dataMode === "synthetic",
    },
  };
}

/** Readable labels for the paths a needs_input response lists; the raw path stays in the audit. */
const PATH_WORDS: [RegExp, string][] = [
  [/annualRentPerSqft/, "Annual rent"],
  [/operatingExpenses/, "Operating expenses"],
  [/occupancyRatio/, "Occupancy"],
  [/collectionLossRatio/, "Collection loss"],
  [/annualConcessions/, "Concessions"],
  [/rentableAreaSqft/, "Rentable area"],
  [/leaseBasis|rentNormalizationNote/, "Lease basis and rent note"],
  [/capex/, "Upfront capital"],
  [/totalProjectCost/, "Total project cost"],
  [/otherPotentialAnnualIncome|otherEffectiveAnnualIncome/, "Other income"],
  [/constraints/, "Investment constraints"],
];
export function missingInputLabel(path: string, scenarioNames: string[]): string {
  const field = PATH_WORDS.find(([re]) => re.test(path))?.[1] ?? "An input";
  const m = /^scenarios\.(\d+)\./.exec(path);
  const scenario = m ? scenarioNames[Number(m[1])] : undefined;
  return scenario ? `${field} for ${scenario}` : field;
}
