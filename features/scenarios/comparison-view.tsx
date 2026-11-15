import { Award, Info } from "lucide-react";
import type { ComparisonResponseDTO, FinancialResultDTO } from "@/lib/contracts";
import { Pill } from "@/components/kestrel/badges";
import { cn } from "@/lib/utils";
import { formatByUnit } from "@/features/dashboard/format";
import { ComparisonChart } from "./comparison-chart";
import { scenarioIdentity } from "./identity";
import { describeMissing } from "./readiness";
import { ProvenanceChip } from "@/components/kestrel/provenance";

type Metric = FinancialResultDTO["noi"];

const CONCLUSION: Record<
  ComparisonResponseDTO["comparison"]["conclusion"],
  { title: string; tone: string; dark: boolean }
> = {
  conditional_preference: { title: "Conditional preference", tone: "border-espresso-700 bg-espresso-900 text-ivory", dark: true },
  retain_baseline: { title: "Retain the baseline", tone: "border-slate-300 bg-white text-slate-900", dark: false },
  insufficient_evidence: { title: "Insufficient evidence — no preferred scenario", tone: "border-amber-300 bg-amber-50 text-amber-950", dark: false },
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

function MetricValue({ metric, onDark = false }: { metric: Metric; onDark?: boolean }) {
  if (metric.value === null)
    return (
      <span>
        <span className={cn("italic", onDark ? "text-ivory/70" : "text-slate-600")}>Unavailable</span>
        {metric.unavailableReason ? (
          <span className={cn("block text-xs font-normal", onDark ? "text-ivory/70" : "text-slate-600")}>
            {metric.unavailableReason}
          </span>
        ) : null}
      </span>
    );
  const negative = metric.value.startsWith("-");
  return (
    <span
      title={`${metric.value} (${metric.unit}) · ${metric.formulaId}`}
      className={cn("tabular-nums", negative && (onDark ? "text-red-300" : "text-red-800"))}
    >
      {formatByUnit(metric.value, metric.unit)}
      {negative ? <span className="sr-only"> (negative)</span> : null}
    </span>
  );
}

export function ComparisonView({
  response,
  stale,
  previous = null,
}: {
  response: ComparisonResponseDTO;
  stale: boolean;
  /** The previous successful comparison, if any, used only to state what changed. */
  previous?: ComparisonResponseDTO | null;
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
  const dark = concl.dark;
  const prevPreferredId = previous?.comparison.preferredScenarioId ?? null;
  const prevName = prevPreferredId
    ? (previous?.scenarios.find((x) => x.id === prevPreferredId)?.name ?? prevPreferredId)
    : null;
  const changed =
    previous !== null &&
    (previous.comparison.preferredScenarioId !== preferredId ||
      previous.comparison.conclusion !== comparison.conclusion);

  return (
    <div className={cn("space-y-5", stale && "opacity-70")} data-testid="comparison-result" data-stale={stale}>
      {stale ? (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>Out of date.</strong> Inputs changed after this comparison was
          calculated. Recalculate to see current results.
        </div>
      ) : null}

      <div className={cn("overflow-hidden rounded-2xl border shadow-sm", concl.tone)} data-testid="recommendation">
        <div className="p-5 sm:p-7">
          <p className={cn("flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]", dark ? "text-copper-300" : "opacity-80")}>
            <Award className="size-4" aria-hidden />
            Recommendation · {concl.title}
            {synthetic ? <ProvenanceChip kind="synthetic" /> : null}
          </p>
          {preferredId ? (
            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="font-display text-3xl leading-tight sm:text-4xl">{name(preferredId)}</p>
                <p className={cn("mt-1 text-sm", dark ? "text-ivory/75" : "opacity-80")}>
                  {scenarios.find((s) => s.id === preferredId)?.proposedUse}
                </p>
              </div>
              {preferredResult ? (
                <dl className="grid w-full grid-cols-1 gap-3 text-sm sm:w-auto sm:grid-cols-3">
                  {(
                    [
                      ["incrementalNoi", "Incremental NOI vs baseline"],
                      ["initialInvestment", "Initial investment"],
                      ["paybackYears", "Simple payback"],
                    ] as [keyof FinancialResultDTO & string, string][]
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className={cn(
                        "rounded-lg border px-4 py-3",
                        dark ? "border-espresso-600 bg-espresso-800" : "border-black/10 bg-white/70",
                      )}
                    >
                      <dt className={cn("text-xs", dark ? "text-ivory/70" : "opacity-80")}>{label}</dt>
                      <dd className="mt-0.5 text-2xl font-semibold">
                        <MetricValue metric={preferredResult[key as "noi"]} onDark={dark} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 font-display text-3xl">No scenario is preferred</p>
          )}
          {comparison.reasons.length ? (
            <div className="mt-3">
              <p className={cn("text-xs font-medium uppercase tracking-wide", dark ? "text-ivory/70" : "opacity-80")}>
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
                  <li key={id} className={cn("inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-3 ring-1", dark ? "bg-espresso-800 ring-espresso-600" : "bg-white/80 ring-black/10")}>
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
              <strong>Missing:</strong>{" "}
              {comparison.missingInputs.map((m) => describeMissing(m, name)).join("; ")}
            </p>
          ) : null}
        </div>
        <p className={cn("flex items-start gap-1.5 border-t px-4 py-2 text-xs sm:px-7", dark ? "border-espresso-700 bg-espresso-950/60 text-ivory/80" : "border-black/10 bg-white/40 opacity-90")}>
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Preliminary income screening. A preference is not an appraisal,
          zoning determination or structural approval, and it does not prove a
          better return.
        </p>
      </div>

      {previous && !stale ? (
        <p
          data-testid="comparison-change"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            changed ? "border-copper-300 bg-copper-50 text-copper-900" : "border-slate-200 bg-white text-slate-700",
          )}
        >
          {changed ? (
            <>
              <strong>Result changed since the last calculation.</strong> Previously{" "}
              {prevName ? <>preferred: <strong>{prevName}</strong></> : "no scenario was preferred"}; now{" "}
              {preferredId ? <>preferred: <strong>{name(preferredId)}</strong></> : "no scenario is preferred"} (input
              revision {previous.inputRevision} → {response.inputRevision}).
            </>
          ) : (
            <>Recalculated: the preferred scenario is unchanged from the last calculation.</>
          )}
        </p>
      ) : null}

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
                "relative min-w-0 overflow-hidden rounded-2xl border bg-white p-4 pt-5 shadow-sm",
                isPreferred ? "border-copper-600 ring-2 ring-copper-600/25" : "border-slate-200",
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
