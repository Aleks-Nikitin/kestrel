import type {
  AnalysisResponseDTO,
  FinancialResultDTO,
} from "@/lib/contracts";
import { describeMissing } from "@/features/scenarios/readiness";
import { DataModeBadge, OriginBadge, Pill } from "@/components/kestrel/badges";
import { ProvenanceChip, ProvenanceLegend, providerKind } from "@/components/kestrel/provenance";
import { Lightbulb, TriangleAlert } from "lucide-react";
import { buildInvestigation } from "./investigation";
import { InvestigationPanel } from "./investigation-panel";
import { formatByUnit } from "@/features/dashboard/format";

type Complete = Extract<AnalysisResponseDTO, { status: "complete" }>;
type Metric = FinancialResultDTO["noi"];

const CONCLUSION_LABEL: Record<Complete["comparison"]["conclusion"], string> = {
  conditional_preference: "Conditional preference",
  retain_baseline: "Retain the baseline",
  insufficient_evidence: "Insufficient evidence — no preferred scenario",
};

const ELIGIBILITY_TONE = {
  eligible: "green",
  conditional: "amber",
  excluded: "red",
  insufficient_data: "slate",
} as const;

function MetricCell({ metric }: { metric: Metric }) {
  if (metric.value === null)
    return (
      <span title={metric.unavailableReason ?? undefined}>
        <span className="italic text-ink-600">Unavailable</span>
        {metric.unavailableReason ? (
          <span className="block text-xs text-ink-600">
            {metric.unavailableReason}
          </span>
        ) : null}
      </span>
    );
  return (
    <span title={`${metric.value} (${metric.unit}) · ${metric.formulaId}`}>
      {formatByUnit(metric.value, metric.unit)}
    </span>
  );
}

const COLUMNS: { key: keyof FinancialResultDTO & string; label: string }[] = [
  { key: "effectiveGrossIncome", label: "Effective gross income" },
  { key: "operatingExpenses", label: "Operating expenses" },
  { key: "noi", label: "NOI" },
  { key: "incrementalNoi", label: "Incremental NOI vs baseline" },
  { key: "initialInvestment", label: "Initial investment" },
  { key: "paybackYears", label: "Simple payback" },
  { key: "yieldOnCost", label: "Yield on cost" },
];

type Claim = Complete["summary"]["claims"][number];

function ClaimList({
  title,
  claims,
  evidence,
}: {
  title: string;
  claims: Claim[];
  evidence: Map<string, Complete["evidence"][number]>;
}) {
  if (!claims.length) return null;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold text-ink-950">{title}</h4>
      <ul className="mt-1 text-sm">
        {claims.map((c) => (
          <li key={c.text} className="border-t border-ink-100 py-3.5 first:border-t-0">
            <p className="max-w-prose font-serif text-[1.08rem] leading-relaxed text-ink-950">{c.text}</p>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
              <ProvenanceChip kind={c.kind} />
              {[...new Set(c.evidenceIds.map((id) => evidence.get(id)?.provider).filter((p) => p !== undefined))].map((p) => (
                <ProvenanceChip key={p} kind={providerKind(String(p))} />
              ))}
              {c.evidenceIds.some((id) => evidence.get(id)?.synthetic) ? <ProvenanceChip kind="synthetic" /> : null}
              {c.metricRefs.length ? <span>Metrics: {c.metricRefs.join(", ")}</span> : null}
            </p>
            {c.evidenceIds.length ? (
              <ul className="mt-1.5 space-y-0.5 border-l-2 border-ink-200 pl-3 text-xs text-ink-600" aria-label="Supporting evidence">
                {c.evidenceIds.map((id) => {
                  const e = evidence.get(id);
                  return (
                    <li key={id}>
                      {e ? e.label : id}
                      {e?.synthetic ? <span className="ml-1 font-medium text-ochre-800">(synthetic)</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-ochre-800">No supporting evidence cited.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisResult({
  response,
  stale,
}: {
  response: AnalysisResponseDTO;
  stale: boolean;
}) {
  if (response.status === "needs_input")
    return (
      <div className="space-y-3" data-testid="analysis-needs-input">
        <div
          role="status"
          className="rounded-lg border border-ochre-300 bg-ochre-50 p-4 text-sm text-ochre-800"
        >
          <p className="font-semibold">More input is needed before a recommendation</p>
          <p className="mt-1">
            No recommendation was produced. Your drafts are preserved; supply
            these inputs and run the analysis again.
          </p>
          <ul className="mt-2 space-y-1">
            {response.missingInputs.map((m) => (
              <li key={m.path}>
                <code className="text-xs">{m.path}</code> — {m.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );

  const names = new Map(response.scenarios.map((s) => [s.id, s.name]));
  const name = (id: string) => names.get(id) ?? id;
  const { comparison, summary, execution, modelUsage } = response;
  const evidenceById = new Map(response.evidence.map((e) => [e.id, e]));
  const facts = summary.claims.filter((c) => c.kind === "fact");
  const uncertain = summary.claims.filter((c) => c.kind !== "fact");
  const feasibility = new Map(comparison.feasibility.map((f) => [f.scenarioId, f]));

  return (
    <div className="space-y-5" data-testid="analysis-complete">
      {stale ? (
        <div
          role="status"
          className="rounded-lg border border-ochre-300 bg-ochre-50 px-4 py-3 text-sm text-ochre-800"
        >
          <strong>Out of date.</strong> Inputs changed after this analysis ran.
          The explanation below is hidden until you run it again.
        </div>
      ) : null}

      <div className="survey-grid rounded-xl bg-ink-900 px-5 py-5 text-white sm:px-8 sm:py-6 [&_li]:text-ink-100 [&_ul]:text-ink-100">
        <p className="text-sm font-medium text-rufous-300">
          Comparison · input revision {comparison.inputRevision}
        </p>
        <p className="type-display mt-2 text-3xl text-buff-100 sm:text-4xl">
          {CONCLUSION_LABEL[comparison.conclusion]}
          {comparison.preferredScenarioId
            ? `: ${name(comparison.preferredScenarioId)}`
            : ""}
        </p>
        <ul className="mt-3 max-w-prose space-y-1 font-serif text-[1.02rem] leading-relaxed">
          {comparison.reasons.map((r) => (
            <li key={r.code}>{r.text}</li>
          ))}
        </ul>
        {comparison.missingInputs.length ? (
          <p className="mt-2 text-sm text-ochre-300">
            Missing: {comparison.missingInputs.map((m) => describeMissing(m, name)).join("; ")}
          </p>
        ) : null}
      </div>

      {!stale ? <InvestigationPanel investigation={buildInvestigation(response)} /> : null}

      {!stale ? (
        <div data-testid="investment-summary" className="rounded-xl border border-ink-200 bg-white px-5 py-6 sm:px-9 sm:py-9">
          <div className="border-b-2 border-ink-900 pb-5">
            <p className="text-sm font-medium text-rufous-700">Investment memo · analyst summary</p>
            <p className="mt-2 max-w-3xl font-serif text-[2rem] leading-[1.15] text-ink-950 sm:text-[2.4rem]">{summary.headline}</p>
            <p className="figure mt-3 text-xs text-ink-500">
              Input revision {comparison.inputRevision} · {summary.claims.length} {summary.claims.length === 1 ? "claim" : "claims"} ·{" "}
              {response.evidence.length} evidence {response.evidence.length === 1 ? "record" : "records"} returned
            </p>
          </div>
          <div className="mt-4"><ProvenanceLegend /></div>
          <ClaimList title="Established facts" claims={facts} evidence={evidenceById} />
          <ClaimList
            title="Assumptions and inferences (uncertain)"
            claims={uncertain}
            evidence={evidenceById}
          />
          <div className="mt-6 grid gap-x-10 gap-y-5 border-t border-ink-200 pt-5 sm:grid-cols-2">
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
                <TriangleAlert className="size-4 text-ochre-600" aria-hidden /> Limitations and unresolved questions
              </h4>
              <ul className="mt-2 space-y-1.5 border-l-2 border-ochre-300 pl-3 text-sm leading-relaxed text-ink-800">
                {summary.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
                <Lightbulb className="size-4 text-ink-500" aria-hidden /> Next steps
              </h4>
              <ol className="figure mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-800">
                {summary.nextSteps.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : null}

      <div
        role="region"
        aria-label="Scenario financial comparison"
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-ink-200 bg-white focus-visible:-outline-offset-2"
      >
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">
            Annual stabilized USD results per scenario. Values are calculated by
            the server, not in the browser.
          </caption>
          <thead className="bg-ink-50 text-xs text-ink-700">
            <tr>
              <th scope="col" className="px-3 py-2">Scenario</th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-3 py-2 text-right">
                  {c.label}
                </th>
              ))}
              <th scope="col" className="px-3 py-2">Eligibility</th>
            </tr>
          </thead>
          <tbody className="figure">
            {comparison.results.map((r) => {
              const f = feasibility.get(r.scenarioId);
              return (
                <tr key={r.scenarioId} className="border-t border-ink-200 align-top">
                  <th scope="row" className="px-3 py-2 font-medium text-ink-900">
                    {name(r.scenarioId)}
                    {r.scenarioId === comparison.preferredScenarioId ? (
                      <span className="ml-2"><Pill tone="blue">Preferred</Pill></span>
                    ) : null}
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-right">
                      <MetricCell metric={r[c.key as "noi"]} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {f ? (
                      <Pill tone={ELIGIBILITY_TONE[f.eligibility]}>
                        {f.eligibility.replace("_", " ")}
                      </Pill>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-600">
        Calculated values <OriginBadge origin="derived_calculation" /> are
        displayed exactly as returned; hover a value for its full precision and
        formula. Payback and yield on cost are shown only when their inputs are
        known.
      </p>

      {comparison.results.some((r) => r.warnings.length) ? (
        <ul className="list-disc pl-5 text-sm text-ink-800">
          {comparison.results.flatMap((r) =>
            r.warnings.map((w) => (
              <li key={`${r.scenarioId}-${w}`}>
                <strong>{name(r.scenarioId)}:</strong> {w}
              </li>
            )),
          )}
        </ul>
      ) : null}

      <div className="rounded-lg border border-ink-200 bg-white p-3 text-xs text-ink-600">
        <p className="flex flex-wrap items-center gap-2">
          <DataModeBadge mode={execution.dataMode} prefix="Run data" />
          <span>
            Model {modelUsage.modelId} ({modelUsage.provider})
            {modelUsage.fallbackUsed ? " — fallback model used" : ""} ·{" "}
            {modelUsage.attempts} attempt{modelUsage.attempts === 1 ? "" : "s"} ·{" "}
            {execution.elapsedMs} ms
          </span>
        </p>
        <p className="mt-1">
          Tools completed:{" "}
          {execution.completedTools.map((t) => t.name).join(", ")}
        </p>
      </div>
    </div>
  );
}
