import { Fragment } from "react";
import { Info } from "lucide-react";
import type { ComparisonResponseDTO, ConstraintsInputDTO, FinancialResultDTO } from "@/lib/contracts";
import { Pill } from "@/components/kestrel/badges";
import { cn } from "@/lib/utils";
import { formatByUnit, formatUsd } from "@/features/dashboard/format";
import { scenarioIdentity } from "./identity";
import { describeMissing } from "./readiness";
import { ProvenanceChip } from "@/components/kestrel/provenance";
import { Term } from "@/components/kestrel/term";

type Metric = FinancialResultDTO["noi"];
type MetricKey = keyof FinancialResultDTO & string;

const CONCLUSION: Record<ComparisonResponseDTO["comparison"]["conclusion"], { title: string; dark: boolean }> = {
  conditional_preference: { title: "Conditional preference", dark: true },
  retain_baseline: { title: "Retain the baseline", dark: false },
  insufficient_evidence: { title: "Insufficient evidence — no preferred scenario", dark: false },
};
const ELIGIBILITY_TONE = { eligible: "green", conditional: "amber", excluded: "red", insufficient_data: "slate" } as const;

/** The pro forma, top to bottom, as an investor reads it. */
const SHEET: { title: string; rows: { key: MetricKey; label: string; term?: string; weight?: "subtotal" | "total"; minus?: boolean }[] }[] = [
  {
    title: "Income",
    rows: [
      { key: "potentialRent", label: "Potential rent" },
      { key: "potentialGrossIncome", label: "Potential gross income", weight: "subtotal" },
      { key: "vacancyLoss", label: "Vacancy loss", minus: true },
      { key: "collectionLoss", label: "Collection loss", minus: true },
      { key: "concessions", label: "Concessions", minus: true },
      { key: "otherIncomeLoss", label: "Other income loss", minus: true },
      { key: "effectiveGrossIncome", label: "Effective gross income", weight: "subtotal", term: "egi" },
      { key: "operatingExpenses", label: "Operating expenses", minus: true },
      { key: "noi", label: "NOI", weight: "total", term: "noi" },
    ],
  },
  {
    title: "Investment",
    rows: [
      { key: "incrementalNoi", label: "Incremental NOI vs baseline", term: "incrementalNoi" },
      { key: "initialInvestment", label: "Initial investment", term: "initialInvestment" },
      { key: "paybackYears", label: "Simple payback", term: "payback" },
      { key: "yieldOnCost", label: "Yield on cost", term: "yieldOnCost" },
    ],
  },
];

function MetricValue({ metric, onDark = false, compact = false }: { metric: Metric; onDark?: boolean; compact?: boolean }) {
  if (metric.value === null)
    return (
      <span title={metric.unavailableReason ?? undefined}>
        <span className={cn("font-normal", onDark ? "text-ink-300" : "text-ink-500")}>Unavailable</span>
        {metric.unavailableReason ? (
          <span className={cn("block text-[11px] font-normal leading-4", compact && "line-clamp-2", onDark ? "text-ink-300" : "text-ink-500")}>
            {metric.unavailableReason}
          </span>
        ) : null}
      </span>
    );
  const negative = metric.value.startsWith("-");
  return (
    <span
      title={`${metric.value} (${metric.unit}) · ${metric.formulaId}`}
      className={cn("figure", negative && (onDark ? "text-brick-300" : "text-brick-700"))}
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
  constraints = null,
}: {
  response: ComparisonResponseDTO;
  stale: boolean;
  /** The previous successful comparison, if any, used only to state what changed. */
  previous?: ComparisonResponseDTO | null;
  /** The limits submitted with the request this result answers; shown as submitted, never evaluated here. */
  constraints?: ConstraintsInputDTO | null;
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

  // Bar lengths are for drawing only; every label re-uses the server's string.
  const nois = comparison.results.map((r) => (r.noi.value === null ? null : Number(r.noi.value)));
  const scale = Math.max(0, ...nois.map((n) => (n === null ? 0 : Math.abs(n))));
  const warnings = comparison.results.some((r) => r.warnings.length);

  return (
    <div className={cn("space-y-5", stale && "opacity-75")} data-testid="comparison-result" data-stale={stale}>
      {stale ? (
        <div role="status" className="rounded-lg border border-ochre-300 bg-ochre-50 px-4 py-3 text-sm text-ochre-800">
          <strong>Out of date.</strong> Inputs changed after this comparison was
          calculated. Recalculate to see current results.
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-xl",
          dark ? "survey-grid bg-ink-900 text-white" : comparison.conclusion === "insufficient_evidence" ? "border border-ochre-300 bg-ochre-50 text-ink-900" : "border border-ink-200 bg-white text-ink-900",
        )}
        data-testid="recommendation"
      >
        <div className="grid gap-x-10 gap-y-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", dark ? "text-rufous-300" : "text-ink-600")}>
              Recommendation · {concl.title}
              {synthetic ? <ProvenanceChip kind="synthetic" /> : null}
            </p>
            {preferredId ? (
              <>
                <p className={cn("type-display mt-3 text-5xl sm:text-6xl", dark ? "text-buff-100" : "text-ink-950")}>{name(preferredId)}</p>
                <p className={cn("mt-2 text-base", dark ? "text-ink-200" : "text-ink-600")}>
                  {scenarios.find((s) => s.id === preferredId)?.proposedUse}
                </p>
              </>
            ) : (
              <p className="type-display mt-3 text-4xl sm:text-5xl">No scenario is preferred</p>
            )}
            {comparison.reasons.length ? (
              <div className="mt-6">
                <p className={cn("text-xs font-medium", dark ? "text-ink-300" : "text-ink-500")}>
                  Why (from the deterministic comparison)
                </p>
                <ul className={cn("mt-1.5 max-w-prose space-y-1.5 font-serif text-[1.05rem] leading-relaxed", dark ? "text-white" : "text-ink-900")}>
                  {comparison.reasons.map((r) => (
                    <li key={r.code}>{r.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {comparison.missingInputs.length ? (
              <p className={cn("mt-4 max-w-prose text-sm", dark ? "text-ink-200" : "text-ink-700")}>
                <strong>Missing:</strong>{" "}
                {comparison.missingInputs.map((m) => describeMissing(m, name)).join("; ")}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-6">
            {preferredResult ? (
              <dl className={cn("divide-y", dark ? "divide-white/15" : "divide-ink-200")}>
                {(
                  [
                    ["incrementalNoi", "Incremental NOI vs baseline"],
                    ["initialInvestment", "Initial investment"],
                    ["paybackYears", "Simple payback"],
                  ] as [MetricKey, string][]
                ).map(([key, label]) => (
                  <div key={key} className="flex items-baseline justify-between gap-4 py-3 first:pt-0">
                    <dt className={cn("text-sm", dark ? "text-ink-200" : "text-ink-600")}>{label}</dt>
                    <dd className="text-right text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                      <MetricValue metric={preferredResult[key as "noi"]} onDark={dark} compact />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {comparison.rankedScenarioIds.length ? (
              <ol className="space-y-1.5 text-sm" aria-label="Ranking, best first">
                {comparison.rankedScenarioIds.map((id, i) => (
                  <li key={id} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "figure grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                        id === preferredId ? "bg-rufous-500 text-white" : dark ? "border border-white/30 text-ink-200" : "border border-ink-300 text-ink-600",
                      )}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className={dark ? "text-ink-100" : "text-ink-800"}>#{i + 1} {name(id)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
        <p className={cn("flex items-start gap-2 border-t px-5 py-2.5 text-xs sm:px-8", dark ? "border-white/10 bg-ink-950/50 text-ink-300" : "border-ink-200 text-ink-600")}>
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
            changed ? "border-rufous-300 bg-rufous-50 text-rufous-800" : "border-ink-200 bg-white text-ink-700",
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

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        {constraints ? (
          <div className="border-b border-ink-200 px-5 py-4 sm:px-6" data-testid="constraints-tested">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-ink-900">Limits this comparison was tested against</span>
              <span className="text-xs text-ink-500">As you submitted them; the server applies them in the feasibility screen</span>
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
              {(
                [
                  ["Maximum initial investment", constraints.maxInitialInvestment.value, "USD", "capitalBudget"],
                  ["Maximum simple payback", constraints.maxPaybackYears.value, "years", "maxPayback"],
                  ["Minimum yield on cost", constraints.minimumYieldOnCost.value, "ratio", "yieldOnCost"],
                ] as [string, string | null, string, string][]
              ).map(([label, value, unit, term]) => (
                <div key={label} className="min-w-0 border-l-2 border-ink-900 pl-3">
                  <dd className={cn("figure text-xl font-semibold tracking-tight", value === null ? "text-ink-400" : "text-ink-950")}>
                    {value === null ? "Not set" : formatByUnit(value, unit)}
                  </dd>
                  <dt className="type-label mt-0.5"><Term id={term}>{label}</Term></dt>
                </div>
              ))}
              <div className="min-w-0 border-l-2 border-ink-900 pl-3">
                <dd className="text-xl font-semibold capitalize tracking-tight text-ink-950">{constraints.riskTolerance}</dd>
                <dt className="type-label mt-0.5"><Term id="riskTolerance">Risk tolerance</Term></dt>
              </div>
            </dl>
          </div>
        ) : null}
        <figure className="border-b border-ink-200 px-5 py-5 sm:px-6">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-base font-semibold text-ink-900">Net operating income by scenario</span>
            <span className="text-xs text-ink-500">USD per year, as returned by the server</span>
          </figcaption>
          <ul className="mt-4 space-y-2.5" aria-label="Annual NOI by scenario">
            {comparison.results.map((r, i) => {
              const sc = scenarios.find((s) => s.id === r.scenarioId);
              const n = nois[i];
              const preferred = r.scenarioId === preferredId;
              return (
                <li key={r.scenarioId} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm max-sm:grid-cols-[minmax(0,1fr)_auto]">
                  <span className={cn("truncate", preferred ? "font-semibold text-ink-950" : "text-ink-700")}>{name(r.scenarioId)}</span>
                  <span className="h-5 rounded-sm bg-ink-50 max-sm:order-last max-sm:col-span-2" aria-hidden>
                    {n === null || scale === 0 ? null : (
                      <span
                        className={cn(
                          "block h-full rounded-sm",
                          n < 0 ? "bg-brick-600" : preferred ? "bg-rufous-600" : sc?.role === "baseline" ? "bg-ink-300" : "bg-ink-700",
                        )}
                        style={{ width: `${Math.max(1, (Math.abs(n) / scale) * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="figure min-w-24 text-right font-semibold text-ink-900">
                    {r.noi.value === null ? <span className="font-normal text-ink-500">Unavailable</span> : formatUsd(r.noi.value)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-500">Rufous marks the preferred scenario; the lightest bar is the baseline.</p>
        </figure>

        <div role="region" aria-label="Pro forma by scenario" tabIndex={0} className="overflow-x-auto focus-visible:-outline-offset-2">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">
              Stabilized annual pro forma per scenario. Every value is calculated by the server and shown as returned.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-52 bg-white px-5 py-4 text-left align-bottom text-xs font-medium text-ink-500 sm:px-6">
                  Stabilized annual, USD
                </th>
                {comparison.results.map((r, i) => {
                  const sc = scenarios.find((s) => s.id === r.scenarioId);
                  const isPreferred = r.scenarioId === preferredId;
                  const k = rank(r.scenarioId);
                  const idn = scenarioIdentity(sc, i);
                  return (
                    <th
                      key={r.scenarioId}
                      scope="col"
                      data-scenario={r.scenarioId}
                      data-preferred={isPreferred}
                      className={cn(
                        "min-w-44 border-l border-ink-100 px-4 py-4 text-right align-bottom font-normal",
                        isPreferred ? "border-t-[3px] border-t-rufous-600 bg-rufous-50" : "border-t-[3px] border-t-transparent",
                      )}
                    >
                      <span className="flex flex-wrap items-center justify-end gap-1">
                        {isPreferred ? <Pill tone="blue">Preferred</Pill> : null}
                        {k ? <Pill>Rank #{k}</Pill> : <Pill>Not ranked</Pill>}
                      </span>
                      <span className="mt-2 flex items-center justify-end gap-2">
                        <span className={cn("grid h-5 min-w-5 place-items-center rounded-[3px] px-1 text-[10px] font-bold", idn.badge)} aria-hidden>
                          {idn.letter}
                        </span>
                        <span className="text-[15px] font-semibold text-ink-950">{name(r.scenarioId)}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {sc?.role === "baseline" ? "Baseline" : "Alternative"} · {sc?.proposedUse}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {SHEET.map((group) => (
                <Fragment key={group.title}>
                  <tr>
                    <th scope="colgroup" colSpan={comparison.results.length + 1} className="border-t border-ink-200 bg-ink-50 px-5 py-1.5 text-left text-xs font-semibold text-ink-700 sm:px-6">
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.key} className={cn(row.weight === "total" && "border-t-2 border-ink-900")}>
                      <th
                        scope="row"
                        className={cn(
                          "sticky left-0 z-10 border-t border-ink-100 bg-white px-5 py-2 text-left font-normal text-ink-700 sm:px-6",
                          row.weight && "font-semibold text-ink-950",
                          row.weight === "total" && "py-3 text-base",
                        )}
                      >
                        {row.minus ? <span className="text-ink-400" aria-hidden>− </span> : null}
                        {row.term ? <Term id={row.term}>{row.label}</Term> : row.label}
                      </th>
                      {comparison.results.map((r) => (
                        <td
                          key={r.scenarioId}
                          className={cn(
                            "border-l border-t border-ink-100 px-4 py-2 text-right align-top text-ink-900",
                            r.scenarioId === preferredId && "bg-rufous-50",
                            row.weight && "font-semibold",
                            row.weight === "total" && "py-3 text-base",
                          )}
                        >
                          <MetricValue metric={r[row.key as "noi"]} compact />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr>
                <th scope="colgroup" colSpan={comparison.results.length + 1} className="border-t border-ink-200 bg-ink-50 px-5 py-1.5 text-left text-xs font-semibold text-ink-700 sm:px-6">
                  Feasibility screen
                </th>
              </tr>
              <tr>
                <th scope="row" className="sticky left-0 z-10 border-t border-ink-100 bg-white px-5 py-3 text-left align-top font-normal text-ink-700 sm:px-6">
                  Eligibility
                </th>
                {comparison.results.map((r) => {
                  const f = feas.get(r.scenarioId);
                  return (
                    <td key={r.scenarioId} className={cn("border-l border-t border-ink-100 px-4 py-3 text-right align-top", r.scenarioId === preferredId && "bg-rufous-50")}>
                      {f ? (
                        <details className="group">
                          <summary className="inline-flex cursor-pointer flex-col items-end gap-1">
                            <Pill tone={ELIGIBILITY_TONE[f.eligibility]}>Eligibility: {f.eligibility.replace("_", " ")}</Pill>
                            <span className="text-xs text-ink-500 underline underline-offset-2 group-open:hidden">
                              {f.checks.length} {f.checks.length === 1 ? "check" : "checks"}
                            </span>
                          </summary>
                          <ul className="mt-2 space-y-1.5 text-left text-xs text-ink-700">
                            {f.checks.map((c) => (
                              <li key={c.code}>
                                <span className="font-semibold">{c.dimension} · {c.status}:</span> {c.explanation}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <span className="text-ink-500">Not reported</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {warnings ? (
                <tr>
                  <th scope="row" className="sticky left-0 z-10 border-t border-ink-100 bg-white px-5 py-3 text-left align-top font-normal text-ink-700 sm:px-6">
                    Warnings
                  </th>
                  {comparison.results.map((r) => (
                    <td key={r.scenarioId} className={cn("border-l border-t border-ink-100 px-4 py-3 text-left align-top text-xs text-ink-700", r.scenarioId === preferredId && "bg-rufous-50")}>
                      {r.warnings.length ? (
                        <ul className="space-y-1">
                          {r.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-200 px-5 py-3 text-xs text-ink-500 sm:px-6">
          Every figure is calculated by the server and shown as returned; hover a
          value for full precision, unit and formula. Payback and yield on cost
          appear only when their inputs are known.
        </p>
      </div>
    </div>
  );
}
