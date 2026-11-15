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
        <span className="italic text-slate-600">Unavailable</span>
        {metric.unavailableReason ? (
          <span className="block text-xs text-slate-600">
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
    <div className="mt-3">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-1 space-y-2 text-sm">
        {claims.map((c) => (
          <li
            key={c.text}
            className={
              "rounded-lg border bg-white p-3 " +
              (c.kind === "fact" ? "border-l-4 border-slate-200 border-l-emerald-600" : "border-l-4 border-slate-200 border-l-amber-500")
            }
          >
            <p className="text-slate-900">{c.text}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <ProvenanceChip kind={c.kind} />
              {[...new Set(c.evidenceIds.map((id) => evidence.get(id)?.provider).filter((p) => p !== undefined))].map((p) => (
                <ProvenanceChip key={p} kind={providerKind(String(p))} />
              ))}
              {c.evidenceIds.some((id) => evidence.get(id)?.synthetic) ? <ProvenanceChip kind="synthetic" /> : null}
              {c.metricRefs.length ? <span>Metrics: {c.metricRefs.join(", ")}</span> : null}
            </p>
            {c.evidenceIds.length ? (
              <ul className="mt-1 text-xs text-slate-700" aria-label="Supporting evidence">
                {c.evidenceIds.map((id) => {
                  const e = evidence.get(id);
                  return (
                    <li key={id}>
                      {e ? e.label : id}
                      {e?.synthetic ? <span className="ml-1 font-medium text-amber-800">(synthetic)</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-amber-900">No supporting evidence cited.</p>
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
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
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
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <strong>Out of date.</strong> Inputs changed after this analysis ran.
          The explanation below is hidden until you run it again.
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
          Comparison · input revision {comparison.inputRevision}
        </p>
        <p className="mt-1 text-base font-semibold text-slate-900">
          {CONCLUSION_LABEL[comparison.conclusion]}
          {comparison.preferredScenarioId
            ? `: ${name(comparison.preferredScenarioId)}`
            : ""}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-800">
          {comparison.reasons.map((r) => (
            <li key={r.code}>{r.text}</li>
          ))}
        </ul>
        {comparison.missingInputs.length ? (
          <p className="mt-2 text-sm text-amber-900">
            Missing: {comparison.missingInputs.map((m) => describeMissing(m, name)).join("; ")}
          </p>
        ) : null}
      </div>

      {!stale ? <InvestigationPanel investigation={buildInvestigation(response)} /> : null}

      {!stale ? (
        <div data-testid="investment-summary" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Investment summary</p>
            <p className="mt-1 text-lg font-semibold leading-snug text-slate-900">{summary.headline}</p>
          </div>
          <ProvenanceLegend />
          <ClaimList title="Established facts" claims={facts} evidence={evidenceById} />
          <ClaimList
            title="Assumptions and inferences (uncertain)"
            claims={uncertain}
            evidence={evidenceById}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-600/20">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-amber-950">
                <TriangleAlert className="size-4" aria-hidden /> Limitations
              </h4>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-950">
                {summary.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-sky-50 p-3 ring-1 ring-sky-600/20">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-sky-950">
                <Lightbulb className="size-4" aria-hidden /> Next steps
              </h4>
              <ol className="mt-1 list-decimal pl-5 text-sm text-sky-950">
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
        className="overflow-x-auto rounded-md border border-slate-200 focus-visible:outline-2 focus-visible:outline-sky-600"
      >
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">
            Annual stabilized USD results per scenario. Values are calculated by
            the server, not in the browser.
          </caption>
          <thead className="bg-slate-50 text-xs text-slate-700">
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
          <tbody className="tabular-nums">
            {comparison.results.map((r) => {
              const f = feasibility.get(r.scenarioId);
              return (
                <tr key={r.scenarioId} className="border-t border-slate-200 align-top">
                  <th scope="row" className="px-3 py-2 font-medium text-slate-900">
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
      <p className="text-xs text-slate-600">
        Calculated values <OriginBadge origin="derived_calculation" /> are
        displayed exactly as returned; hover a value for its full precision and
        formula. Payback and yield on cost are shown only when their inputs are
        known.
      </p>

      {comparison.results.some((r) => r.warnings.length) ? (
        <ul className="list-disc pl-5 text-sm text-slate-800">
          {comparison.results.flatMap((r) =>
            r.warnings.map((w) => (
              <li key={`${r.scenarioId}-${w}`}>
                <strong>{name(r.scenarioId)}:</strong> {w}
              </li>
            )),
          )}
        </ul>
      ) : null}

      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
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
