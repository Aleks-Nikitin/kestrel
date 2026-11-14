import { Award, Info } from "lucide-react";
import type { ComparisonResponseDTO, FinancialResultDTO } from "@/lib/contracts";
import { Pill } from "@/components/kestrel/badges";
import { cn } from "@/lib/utils";
import { formatByUnit } from "@/features/dashboard/format";
import { ComparisonChart } from "./comparison-chart";
import { scenarioIdentity } from "./identity";
import { ProvenanceChip } from "@/components/kestrel/provenance";

type Metric = FinancialResultDTO["noi"];

const CONCLUSION: Record<
  ComparisonResponseDTO["comparison"]["conclusion"],
  { title: string; tone: string }
> = {
  conditional_preference: { title: "Conditional preference", tone: "border-sky-300 bg-sky-50 text-sky-950" },
  retain_baseline: { title: "Retain the baseline", tone: "border-slate-300 bg-slate-50 text-slate-900" },
  insufficient_evidence: { title: "Insufficient evidence — no preferred scenario", tone: "border-amber-300 bg-amber-50 text-amber-950" },
};
const ELIGIBILITY_TONE = { eligible: "green", conditional: "amber", excluded: "red", insufficient_data: "slate" } as const;

const HEADLINE: [keyof FinancialResultDTO & string, string][] = [
  ["noi", "NOI"],
  ["incrementalNoi", "Incremental NOI vs baseline"],
  ["initialInvestment", "Initial investment"],
  ["paybackYears", "Simple payback"],
  ["yieldOnCost", "Yield on cost"],
];
const WATERFALL: [keyof FinancialResultDTO & string, string][] = [
  ["potentialRent", "Potential rent"],
  ["potentialGrossIncome", "Potential gross income"],
  ["vacancyLoss", "Vacancy loss"],
  ["collectionLoss", "Collection loss"],
  ["concessions", "Concessions"],
  ["otherIncomeLoss", "Other income loss"],
  ["effectiveGrossIncome", "Effective gross income"],
  ["operatingExpenses", "Operating expenses"],
];

function MetricValue({ metric }: { metric: Metric }) {
  if (metric.value === null)
    return (
      <span>
        <span className="italic text-slate-600">Unavailable</span>
        {metric.unavailableReason ? (
          <span className="block text-xs text-slate-600">{metric.unavailableReason}</span>
        ) : null}
      </span>
    );
  const negative = metric.value.startsWith("-");
  return (
    <span
      title={`${metric.value} (${metric.unit}) · ${metric.formulaId}`}
      className={cn("tabular-nums", negative && "text-red-800")}
    >
      {formatByUnit(metric.value, metric.unit)}
      {negative ? <span className="sr-only"> (negative)</span> : null}
    </span>
  );
}

export function ComparisonView({
  response,
  stale,
}: {
  response: ComparisonResponseDTO;
  stale: boolean;
}) {
  const { comparison, scenarios } = response;
  const name = (id: string) => scenarios.find((s) => s.id === id)?.name ?? id;
  const rank = (id: string) => {
    const i = comparison.rankedScenarioIds.indexOf(id);
    return i === -1 ? null : i + 1;
  };
  const feas = new Map(comparison.feasibility.map((f) => [f.scenarioId, f]));
  const synthetic = response.evidence.some((e) => e.synthetic);
  const concl = CONCLUSION[comparison.conclusion];
  const preferredId = comparison.preferredScenarioId;
  const preferredResult = comparison.results.find((r) => r.scenarioId === preferredId);

  return (
    <div className={cn("space-y-5", stale && "opacity-70")} data-testid="comparison-result" data-stale={stale}>
      {stale ? (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>Out of date.</strong> Inputs changed after this comparison was
          calculated. Recalculate to see current results.
        </div>
      ) : null}

      <div className={cn("overflow-hidden rounded-xl border", concl.tone)} data-testid="recommendation">
        <div className="p-4 sm:p-5">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
            <Award className="size-4" aria-hidden />
            Recommendation · {concl.title}
            {synthetic ? <ProvenanceChip kind="synthetic" /> : null}
          </p>
          {preferredId ? (
            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-2xl font-semibold leading-tight">{name(preferredId)}</p>
                <p className="text-sm opacity-80">
                  {scenarios.find((s) => s.id === preferredId)?.proposedUse}
                </p>
              </div>
              {preferredResult ? (
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {(
                    [
                      ["incrementalNoi", "Incremental NOI vs baseline"],
                      ["initialInvestment", "Initial investment"],
                      ["paybackYears", "Simple payback"],
                    ] as [keyof FinancialResultDTO & string, string][]
                  ).map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-xs opacity-80">{label}</dt>
                      <dd className="text-lg font-semibold">
                        <MetricValue metric={preferredResult[key as "noi"]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xl font-semibold">No scenario is preferred</p>
          )}
          {comparison.reasons.length ? (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                Why (from the deterministic comparison)
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {comparison.reasons.map((r) => (
                  <li key={r.code}>{r.text}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {comparison.rankedScenarioIds.length ? (
            <ol className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Ranking, best first">
              {comparison.rankedScenarioIds.map((id, i) => {
                const idn = scenarioIdentity(scenarios.find((x) => x.id === id), i);
                return (
                  <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 py-0.5 pl-0.5 pr-3 ring-1 ring-black/10">
                    <span className={cn("grid size-6 place-items-center rounded-full text-[11px] font-bold", idn.badge)} aria-hidden>
                      {i + 1}
                    </span>
                    #{i + 1} {name(id)}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {comparison.missingInputs.length ? (
            <p className="mt-2 text-sm">
              <strong>Missing:</strong> {comparison.missingInputs.join("; ")}
            </p>
          ) : null}
        </div>
        <p className="flex items-start gap-1.5 border-t border-black/10 bg-white/40 px-4 py-2 text-xs opacity-90 sm:px-5">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Preliminary income screening. A preference is not an appraisal,
          zoning determination or structural approval, and it does not prove a
          better return.
        </p>
      </div>

      <ComparisonChart
        data={scenarios.map((s) => {
          const r = comparison.results.find((x) => x.scenarioId === s.id);
          return {
            id: s.id,
            name: s.name,
            noi: r?.noi.value ?? null,
            preferred: s.id === preferredId,
            baseline: s.role === "baseline",
          };
        })}
      />

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Scenario results">
        {comparison.results.map((r) => {
          const f = feas.get(r.scenarioId);
          const sc = scenarios.find((s) => s.id === r.scenarioId);
          const isPreferred = r.scenarioId === preferredId;
          const k = rank(r.scenarioId);
          const idn = scenarioIdentity(sc, comparison.results.indexOf(r));
          return (
            <li
              key={r.scenarioId}
              data-scenario={r.scenarioId}
              data-preferred={isPreferred}
              className={cn(
                "relative min-w-0 overflow-hidden rounded-xl border bg-white p-4 pt-5",
                isPreferred ? "border-sky-600 ring-2 ring-sky-600/30" : "border-slate-200",
              )}
            >
              <span className={cn("absolute inset-x-0 top-0 h-1.5", idn.bar)} aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className={cn("mt-0.5 grid h-6 min-w-6 place-items-center rounded-md px-1 text-[11px] font-bold", idn.badge)} aria-hidden>
                    {idn.letter}
                  </span>
                  <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900">{name(r.scenarioId)}</h4>
                  <p className="text-xs text-slate-600">
                    {sc?.role === "baseline" ? "Baseline" : "Alternative"} · {sc?.proposedUse}
                  </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {isPreferred ? <Pill tone="blue">Preferred</Pill> : null}
                  {k ? <Pill>Rank #{k}</Pill> : <Pill>Not ranked</Pill>}
                </div>
              </div>
              <dl className="mt-3 divide-y divide-slate-100 text-sm">
                {HEADLINE.map(([key, label]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 py-1.5">
                    <dt className="text-slate-700">{label}</dt>
                    <dd className={cn("text-right text-slate-900", key === "noi" && "text-base font-semibold")}>
                      <MetricValue metric={r[key as "noi"]} />
                    </dd>
                  </div>
                ))}
              </dl>
              {f ? (
                <div className="mt-3">
                  <Pill tone={ELIGIBILITY_TONE[f.eligibility]}>
                    Eligibility: {f.eligibility.replace("_", " ")}
                  </Pill>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {f.checks.map((c) => (
                      <li key={c.code}>
                        <span className="font-medium">{c.dimension} · {c.status}:</span> {c.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <details className="mt-3 text-xs text-slate-700">
                <summary className="cursor-pointer select-none font-medium focus-visible:outline-2 focus-visible:outline-sky-600">
                  Income waterfall
                </summary>
                <dl className="mt-1 divide-y divide-slate-100">
                  {WATERFALL.map(([key, label]) => (
                    <div key={key} className="flex justify-between gap-3 py-1">
                      <dt>{label}</dt>
                      <dd className="text-right"><MetricValue metric={r[key as "noi"]} /></dd>
                    </div>
                  ))}
                </dl>
              </details>
              {r.warnings.length ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">
                  {r.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-600">
        Every figure is calculated by the server and shown as returned; hover a
        value for full precision, unit and formula. Payback and yield on cost
        appear only when their inputs are known.
      </p>
    </div>
  );
}
