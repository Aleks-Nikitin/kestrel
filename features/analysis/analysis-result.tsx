import type { ReactNode } from "react";
import { ArrowRight, Check, CircleDashed, OctagonAlert, ShieldCheck } from "lucide-react";
import type { AnalysisResponseDTO } from "@/lib/contracts";
import { DATA_MODE_LABEL } from "@/features/dashboard/format";
import { ProvenanceChip, PROVENANCE_LABEL } from "@/components/kestrel/provenance";
import { cn } from "@/lib/utils";
import type { AnalysisAction } from "./actions";
import { buildInvestigation } from "./investigation";
import { InvestigationPanel } from "./investigation-panel";
import {
  DIMENSION_LABEL,
  STATUS_LABEL,
  buildMemoView,
  missingInputLabel,
  type MemoClaim,
  type MemoFinding,
  type MemoMetric,
  type MemoSection,
  type MemoView,
} from "./memo-view";

/** A memo section: a title column beside its content, ruled off from the one above. */
function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} data-memo-section={id} className="grid gap-x-10 gap-y-3 border-t border-ink-200 px-5 py-7 sm:px-9 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <h3 id={id} className="type-display text-2xl text-ink-950">
          {title}
        </h3>
        {note ? <p className="mt-1.5 text-[13px] leading-5 text-ink-500">{note}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Figure({ m, lead }: { m: MemoMetric; lead?: boolean }) {
  return (
    <div className="min-w-0 border-l border-ink-200 pl-4 first:border-l-0 first:pl-0 max-lg:[&:nth-child(odd)]:border-l-0 max-lg:[&:nth-child(odd)]:pl-0">
      <dt className="type-label">{m.label}</dt>
      <dd
        className={cn("figure mt-1 font-semibold tracking-tight", lead ? "text-2xl leading-none text-ink-950 sm:text-[1.9rem]" : "text-2xl leading-none text-ink-950")}
        title={m.exact.value === null ? undefined : `${m.exact.value} (${m.exact.unit})`}
      >
        {m.display ?? <span className="text-base font-medium leading-snug tracking-normal text-ink-500">{m.unavailable}</span>}
      </dd>
    </div>
  );
}

const FINDING_ICON = {
  excluded: <OctagonAlert className="mt-0.5 size-4 shrink-0 text-brick-600" aria-hidden />,
  unverified: <CircleDashed className="mt-0.5 size-4 shrink-0 text-ochre-600" aria-hidden />,
  supported: <Check className="mt-0.5 size-4 shrink-0 text-spruce-600" strokeWidth={3} aria-hidden />,
} as const;

function Finding({ f, total }: { f: MemoFinding; total: number }) {
  return (
    <li className="flex gap-3 py-3">
      {FINDING_ICON[f.status]}
      <div className="min-w-0">
        <p className="text-[15px] leading-relaxed text-ink-950">{f.explanation}</p>
        <p className="mt-1 text-xs text-ink-500">
          {DIMENSION_LABEL[f.dimension]} check, {STATUS_LABEL[f.status].toLowerCase()}.{" "}
          {f.scenarios.length === total ? "Applies to every scenario." : `Applies to ${f.scenarios.join(", ")}.`}
        </p>
      </div>
    </li>
  );
}

function Claim({ c }: { c: MemoClaim }) {
  return (
    <li className="py-3">
      <p className="max-w-prose font-serif text-[1.06rem] leading-relaxed text-ink-950">{c.text}</p>
      <ul aria-label="Supporting evidence" className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {c.sources.length ? (
          c.sources.map((s) => (
            <li key={s}>
              <ProvenanceChip kind={s} />
            </li>
          ))
        ) : (
          <li className="text-xs text-ochre-700">No supporting evidence cited</li>
        )}
        {c.synthetic ? (
          <li>
            <ProvenanceChip kind="synthetic" />
          </li>
        ) : null}
      </ul>
    </li>
  );
}

/** Shows the first few items and keeps the rest one click away, in place. */
function Capped<T>({ items, limit, noun, render }: { items: T[]; limit: number; noun: string; render: (item: T, i: number) => ReactNode }) {
  const rest = items.slice(limit);
  return (
    <>
      <ul className="divide-y divide-ink-100">{items.slice(0, limit).map(render)}</ul>
      {rest.length ? (
        <details className="group border-t border-ink-100">
          <summary className="cursor-pointer py-2 text-sm font-medium text-rufous-700 underline underline-offset-4 group-open:hidden">
            Show {rest.length} more {noun}
          </summary>
          <ul className="divide-y divide-ink-100">{rest.map((item, i) => render(item, limit + i))}</ul>
        </details>
      ) : null}
    </>
  );
}

function sections(v: MemoView): Record<MemoSection, ReactNode> {
  const open = v.findings.filter((f) => f.status !== "supported");
  const supported = v.findings.filter((f) => f.status === "supported");
  const total = v.ranking.length;
  return {
    ranking: (
      <Section key="ranking" id="memo-ranking" title="How the scenarios rank" note="Ranked by the deterministic comparison, best first.">
        <ol className="divide-y divide-ink-100">
          {[...v.ranking]
            .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
            .map((r) => (
              <li key={r.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5">
                <span className={cn("figure text-sm font-semibold", r.preferred ? "text-rufous-600" : "text-ink-400")}>{r.rank ?? "–"}</span>
                <span className="min-w-0">
                  <span className={cn("text-[15px]", r.preferred ? "font-semibold text-ink-950" : "text-ink-800")}>{r.name}</span>
                  <span className="block text-xs text-ink-500">
                    {r.preferred ? "Preferred. " : r.rank === null ? "Not ranked. " : ""}
                    {r.baseline ? "Baseline. " : ""}
                    {r.eligibility}
                  </span>
                </span>
                <span className="figure text-right text-[15px] font-semibold text-ink-950">{r.noi.display ?? <span className="font-normal text-ink-500">{r.noi.unavailable}</span>}</span>
              </li>
            ))}
        </ol>
      </Section>
    ),
    financials: null,
    rationale: (
      <Section key="rationale" id="memo-rationale" title="Why this result" note="The comparison policy's own reasons, not a model's.">
        {v.rationale.length ? (
          <ul className="space-y-3">
            {v.rationale.map((r) => (
              <li key={r.key}>
                <p className="max-w-prose font-serif text-[1.12rem] leading-relaxed text-ink-950">{r.text}</p>
                {r.scenarios.length ? <p className="mt-0.5 text-xs text-ink-500">Concerns {r.scenarios.join(", ")}.</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-600">The comparison returned no stated reasons.</p>
        )}
      </Section>
    ),
    risks: (
      <Section key="risks" id="memo-risks" title="Risks and open questions" note="A due-diligence list. Identical findings are shown once.">
        {open.length ? (
          <ul className="-mt-3 divide-y divide-ink-100">{open.map((f) => <Finding key={`${f.dimension}-${f.status}-${f.code}-${f.explanation}`} f={f} total={total} />)}</ul>
        ) : (
          <p className="text-sm text-ink-600">The feasibility screen returned no blocking or unverified findings.</p>
        )}
        {supported.length ? (
          <details className="group border-t border-ink-100">
            <summary className="cursor-pointer py-2 text-sm font-medium text-ink-700 underline underline-offset-4">
              {supported.length} supported {supported.length === 1 ? "check" : "checks"}
            </summary>
            <ul className="divide-y divide-ink-100">{supported.map((f) => <Finding key={`${f.dimension}-${f.code}-${f.explanation}`} f={f} total={total} />)}</ul>
          </details>
        ) : null}
        <div className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {v.limitations.length + v.warnings.length + v.missing.length ? (
            <div>
              <h4 className="text-sm font-semibold text-ink-950">Limits of this analysis</h4>
              <ul className="mt-2 space-y-1.5 border-l-2 border-ochre-300 pl-3 text-sm leading-relaxed text-ink-800">
                {v.missing.map((m) => (
                  <li key={m}>Missing: {m}</li>
                ))}
                {v.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
                {v.warnings
                  .filter((w) => !v.limitations.includes(w.text))
                  .map((w) => (
                    <li key={w.text}>
                      {w.text}
                      {w.scenarios.length < total ? <span className="text-ink-500"> ({w.scenarios.join(", ")})</span> : null}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          {v.nextSteps.length ? (
            <div>
              <h4 className="text-sm font-semibold text-ink-950">Next steps</h4>
              <ol className="figure mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-800">
                {v.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </Section>
    ),
    evidence: (
      <Section key="evidence" id="memo-evidence" title="What the evidence supports" note="Each statement carries the kind of source behind it.">
        {v.claims.facts.length ? (
          <>
            <h4 className="text-sm font-semibold text-ink-950">Stated as fact</h4>
            <p className="mt-0.5 text-xs leading-5 text-ink-500">The badges show what each statement rests on. A statement resting on your assumption is not verified market data.</p>
            <Capped items={v.claims.facts} limit={4} noun="statements" render={(c, i) => <Claim key={i} c={c} />} />
          </>
        ) : null}
        {v.claims.uncertain.length ? (
          <div className={v.claims.facts.length ? "mt-5" : undefined}>
            <h4 className="text-sm font-semibold text-ink-950">Assumptions and inferences</h4>
            <p className="mt-0.5 text-xs leading-5 text-ink-500">
              Not source facts. Calculated summaries are listed here too; that says where they come from, not that the arithmetic is unchecked.
            </p>
            <Capped items={v.claims.uncertain} limit={3} noun="statements" render={(c, i) => <Claim key={i} c={c} />} />
          </div>
        ) : null}
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
          <span className="font-medium text-ink-700">Evidence returned with this run:</span>
          {v.evidence.map((g) => (
            <span key={g.kind} className="figure whitespace-nowrap">
              {g.count} {PROVENANCE_LABEL[g.kind]}
              {g.synthetic ? ` (${g.synthetic} synthetic)` : ""}
            </span>
          ))}
        </p>
      </Section>
    ),
  };
}

function Audit({ response, view }: { response: Extract<AnalysisResponseDTO, { status: "complete" }>; view: MemoView }) {
  const th = "px-3 py-2 text-left font-medium";
  return (
    <details className="group rounded-xl border border-ink-200 bg-white" data-testid="technical-audit">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-5 py-4 hover:bg-ink-50 sm:px-9">
        <span>
          <span className="block text-base font-semibold text-ink-950">Technical audit</span>
          <span className="block text-[13px] text-ink-600">Reported tool executions, claim classifications, evidence records, exact values and run metadata.</span>
        </span>
        <span aria-hidden className="mr-1 size-2 shrink-0 rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-500 transition-transform group-open:-rotate-135" />
      </summary>
      <div className="space-y-7 border-t border-ink-200 px-5 py-6 sm:px-9">
        <InvestigationPanel investigation={buildInvestigation(response)} />

        <div>
          <h4 className="text-sm font-semibold text-ink-950">Exact values for {view.subject.name}</h4>
          <p className="mt-0.5 text-xs text-ink-500">The memo rounds for reading. These are the server&apos;s strings, units and formulas, unchanged.</p>
          <div role="region" aria-label="Exact financial values" tabIndex={0} className="mt-2 overflow-x-auto rounded-lg border border-ink-200 focus-visible:-outline-offset-2">
            <table className="w-full min-w-[32rem] text-xs">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th scope="col" className={th}>Metric</th>
                  <th scope="col" className={th}>Value</th>
                  <th scope="col" className={th}>Unit</th>
                  <th scope="col" className={th}>Formula</th>
                </tr>
              </thead>
              <tbody className="figure">
                {view.highlights.map((m) => (
                  <tr key={m.key} className="border-t border-ink-100">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-ink-900">{m.label}</th>
                    <td className="px-3 py-2">{m.exact.value ?? <span className="text-ink-500">unavailable: {m.exact.reason}</span>}</td>
                    <td className="px-3 py-2">{m.exact.unit}</td>
                    <td className="px-3 py-2 font-mono">{m.exact.formulaId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-950">Submitted claims and their classification</h4>
          <ul className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-200 text-xs">
            {[...view.claims.facts, ...view.claims.uncertain].map((c, i) => (
              <li key={i} className="px-3 py-2.5">
                <p className="text-[13px] text-ink-900">
                  <span className="mr-2 font-semibold capitalize">{c.kind}</span>
                  {c.text}
                </p>
                <p className="mt-1 text-ink-500 [overflow-wrap:anywhere]">
                  Evidence: {c.evidenceIds.length ? c.evidenceIds.join(", ") : "none cited"}
                  {c.metricRefs.length ? ` · Metrics: ${c.metricRefs.join(", ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-950">Feasibility findings with codes</h4>
          <ul className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-200 text-xs">
            {view.findings.map((f) => (
              <li key={`${f.dimension}-${f.status}-${f.code}-${f.explanation}`} className="px-3 py-2.5 text-ink-700 [overflow-wrap:anywhere]">
                <span className="font-mono text-ink-900">{f.dimension}.{f.status}.{f.code}</span> · {f.scenarios.join(", ")}
                <span className="block text-ink-500">Evidence: {f.evidenceIds.length ? f.evidenceIds.join(", ") : "none"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-950">Evidence records returned</h4>
          <p className="mt-0.5 text-xs text-ink-500">
            Returned with the response. A record being returned or touched by a tool is not proof it was individually examined.
          </p>
          <div className="mt-2 space-y-2">
            {view.evidence.map((g) => (
              <details key={g.kind} className="rounded-lg border border-ink-200 text-xs">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2">
                  <ProvenanceChip kind={g.kind} />
                  <span className="figure text-ink-600">
                    {g.count} {g.count === 1 ? "record" : "records"}
                  </span>
                </summary>
                <ul className="divide-y divide-ink-100 border-t border-ink-200">
                  {g.records.map((r) => (
                    <li key={r.id} className="px-3 py-2 [overflow-wrap:anywhere]">
                      <span className="text-ink-900">{r.label}</span>
                      <span className="block font-mono text-ink-500">
                        {r.id} · {r.kind}
                        {r.synthetic ? " · synthetic" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

export function AnalysisResult({
  response,
  stale,
  action = null,
}: {
  response: AnalysisResponseDTO;
  stale: boolean;
  /** The action that produced this response; it only changes what the memo leads with. */
  action?: AnalysisAction | null;
}) {
  // A result for older inputs is never shown as if it were current.
  if (stale)
    return (
      <div role="status" data-testid="analysis-stale" className="rounded-xl border border-ochre-300 bg-ochre-50 px-5 py-8 text-center sm:px-9">
        <p className="type-display text-3xl text-ink-950">Analysis needs updating</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ochre-800">
          Inputs changed after this analysis ran. Its recommendation, figures, evidence summary and verification
          described the earlier inputs, so they are hidden. Run an action again to investigate the current scenarios.
        </p>
      </div>
    );

  if (response.status === "needs_input") {
    const names = response.scenarios.map((s) => s.name);
    return (
      <div className="rounded-xl border border-ochre-300 bg-ochre-50 px-5 py-6 sm:px-9" data-testid="analysis-needs-input" role="status">
        <p className="type-display text-3xl text-ink-950">More input is needed before a recommendation</p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ochre-800">
          No recommendation was produced. Your drafts are preserved; supply these inputs and run the analysis again.
        </p>
        <ul className="mt-4 divide-y divide-ochre-300/60 border-y border-ochre-300/60">
          {response.missingInputs.map((m) => (
            <li key={m.path} className="py-2.5 text-sm text-ink-900">
              <span className="font-semibold">{missingInputLabel(m.path, names)}.</span> {m.reason}
              <details className="text-xs text-ink-500">
                <summary className="cursor-pointer underline underline-offset-2">Field path</summary>
                <code>{m.path}</code>
              </details>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const v = buildMemoView(response, action);
  const body = sections(v);
  const verified = v.verification !== null;
  return (
    <div className="space-y-5" data-testid="analysis-complete">
      <p className="text-[13px] leading-5 text-ink-600" data-testid="memo-focus">
        <span className="font-semibold text-ink-950">Focused view: {v.focus.title}.</span> {v.focus.note} Every action returns the
        same checked result; the view changes what it leads with, not what was found.
      </p>

      <article data-testid="investment-summary" className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <header className="survey-grid grid gap-x-10 gap-y-7 bg-ink-900 px-5 py-7 text-white sm:px-9 sm:py-9 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-rufous-300">Investment memo · {v.decision.label}</p>
            <p className="type-display mt-3 text-5xl text-buff-100 sm:text-6xl">{v.decision.preferred?.name ?? "No scenario is preferred"}</p>
            {v.decision.preferred ? <p className="mt-2 text-base text-ink-200">{v.decision.preferred.proposedUse}</p> : null}
            <p className="mt-5 max-w-prose font-serif text-[1.2rem] leading-relaxed text-white">{v.decision.headline}</p>
            {v.decision.preferred ? (
              <p className="mt-4 inline-flex items-center gap-2 border-t border-white/20 pt-3 text-sm text-ink-100">
                <span className="text-ink-300">Against your limits:</span> {v.decision.preferred.eligibility}
              </p>
            ) : null}
          </div>
          <div className={cn("min-w-0 self-start rounded-lg border p-4", verified ? "border-spruce-300/60 bg-spruce-800/40" : "border-dashed border-white/25")} data-testid="memo-verification">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              {verified ? <ShieldCheck className="size-4 shrink-0 text-spruce-300" aria-hidden /> : <CircleDashed className="size-4 text-ink-300" aria-hidden />}
              {verified ? "Checked against retrieved inputs and deterministic calculations" : "No verification receipt for this run"}
            </p>
            <p className="mt-2 text-[13px] leading-5 text-ink-200">
              {verified
                ? "The analyst's submitted claims were checked, as a set, for consistency with the retrieved evidence and the calculator's figures."
                : "The response carries no verification receipt, so no check is claimed."}
            </p>
            <p className="mt-2 text-[13px] leading-5 text-ink-300">
              Not checked: market accuracy of source records, zoning or legal permission, and physical suitability. No per-statement verdict is reported.
            </p>
            <p className="figure mt-3 border-t border-white/15 pt-2.5 text-xs text-ink-300" data-testid="memo-sources">
              {v.sources.mixed ? "Mixed data sources" : "Data sources"}: property {(DATA_MODE_LABEL[v.sources.property] ?? v.sources.property).toLowerCase()}, spatial{" "}
              {(DATA_MODE_LABEL[v.sources.spatial] ?? v.sources.spatial).toLowerCase()}
            </p>
          </div>
        </header>

        <section aria-labelledby="memo-financials" data-memo-section="memo-financials" className="px-5 py-7 sm:px-9">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 id="memo-financials" className="type-display text-2xl text-ink-950">
              Financial implications
            </h3>
            <p className="text-[13px] text-ink-500">
              {v.subject.name}, one stabilized year. Calculated by the server and rounded here for reading.
            </p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-5">
            {v.highlights.map((m, i) => (
              <Figure key={m.key} m={m} lead={i === 0} />
            ))}
          </dl>
          <a href="#comparison" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-rufous-700 underline underline-offset-4 hover:text-rufous-800">
            Open the full pro forma for every scenario <ArrowRight className="size-4" aria-hidden />
          </a>
        </section>

        {v.focus.order.map((id) => body[id])}

        <section aria-labelledby="memo-activity" className="grid gap-x-10 gap-y-3 border-t border-ink-200 bg-ink-50 px-5 py-6 sm:px-9 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div>
            <h3 id="memo-activity" className="type-display text-2xl text-ink-950">
              What the analyst did
            </h3>
            <p className="mt-1.5 text-[13px] leading-5 text-ink-500">Steps the backend reports as completed. Grouped, not a timeline.</p>
          </div>
          <ul className="grid gap-x-8 gap-y-2 self-center sm:grid-cols-2" data-testid="memo-activity">
            {v.activity.map((a) => (
              <li key={a.label} className="flex items-baseline gap-2 text-[15px] text-ink-900">
                <Check className="size-3.5 shrink-0 translate-y-0.5 text-spruce-600" strokeWidth={3} aria-hidden />
                {a.label}
                {a.count > 1 ? <span className="figure text-xs text-ink-500">{a.count} steps</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </article>

      <Audit response={response} view={v} />
    </div>
  );
}
