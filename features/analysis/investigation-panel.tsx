import { ListChecks, Wrench } from "lucide-react";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
import { ProvenanceChip, providerKind } from "@/components/kestrel/provenance";
import type { Investigation } from "./investigation";

/**
 * What the backend reports about how an analysis was produced: the tool calls
 * it completed, the evidence they touched, and how many claims cite support.
 * It is not a transcript or a reasoning timeline, and it does not mark any
 * claim independently true: the receipt establishes deterministic consistency.
 */
export function InvestigationPanel({ investigation: i }: { investigation: Investigation }) {
  return (
    <section
      aria-labelledby="investigation-heading"
      data-testid="investigation-panel"
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="investigation-heading" className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Wrench className="size-4 text-slate-600" aria-hidden /> How this was investigated
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Tool calls the backend reports as completed. This is not a record of the model&apos;s reasoning.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill>{i.steps.length} tool {i.steps.length === 1 ? "call" : "calls"}</Pill>
          <Pill>{i.evidenceTouched} evidence {i.evidenceTouched === 1 ? "record" : "records"}</Pill>
        </div>
      </div>

      <ol aria-label="Completed tool calls, in the order reported" className="mt-3 space-y-2" data-testid="tool-steps">
        {i.steps.map((s, n) => (
          <li key={s.toolCallId} className="rounded-lg border border-slate-200 p-3" data-testid="tool-step">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="grid size-5 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700" aria-hidden>
                {n + 1}
              </span>
              <span className="text-sm font-medium text-slate-900">{s.label}</span>
              <code className="text-xs text-slate-600">{s.name}</code>
              <span className="text-xs text-slate-600">
                · call <code>{s.toolCallId}</code>
              </span>
              <Pill tone="green">completed</Pill>
            </div>
            {s.evidence.length || s.unresolved.length ? (
              <details className="mt-1 text-xs text-slate-700">
                <summary className="cursor-pointer rounded text-sky-800 focus-visible:outline-2 focus-visible:outline-sky-600">
                  {s.evidence.length} evidence {s.evidence.length === 1 ? "record" : "records"} touched
                </summary>
                <ul className="mt-1 space-y-0.5 pl-1">
                  {s.evidence.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-1.5">
                      <ProvenanceChip kind={providerKind(e.provider)} />
                      {e.synthetic ? <ProvenanceChip kind="synthetic" /> : null}
                      <span>{e.label}</span>
                    </li>
                  ))}
                  {s.unresolved.map((id) => (
                    <li key={id} className="text-amber-900">
                      Evidence <code>{id}</code> is not in the returned evidence table.
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="mt-1 text-xs text-slate-600">No evidence reported for this call.</p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-slate-600">Listed in the order the backend returned them; not a timeline.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3 text-sm" data-testid="claim-support">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
            <ListChecks className="size-3.5" aria-hidden /> Claims and cited support
          </h4>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-slate-800">
            <dt>Factual claims</dt>
            <dd className="tabular-nums">{i.claims.facts}</dd>
            <dt>…citing evidence or a calculated metric</dt>
            <dd className="tabular-nums">{i.claims.factsWithCitedSupport}</dd>
            <dt>…citing neither</dt>
            <dd className="tabular-nums">{i.claims.factsWithoutCitedSupport}</dd>
            <dt>Assumptions and inferences</dt>
            <dd className="tabular-nums">{i.claims.assumptionsAndInferences}</dd>
          </dl>
          {i.claims.factsWithoutCitedSupport > 0 ? (
            <p className="mt-1 text-xs font-medium text-amber-900">
              Some factual claims cite no support. Treat them as unsupported.
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-600">
            Citing support is not the same as being verified.
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm" data-testid="verification-status">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Deterministic consistency checks</h4>
          {i.verification ? (
            <>
              <p className="mt-1 font-medium text-emerald-800">Bound claims verified against retrieved evidence and screening policy.</p>
              <p className="mt-1 text-xs text-slate-700">
                {i.verification.submissionAttempts} submission{i.verification.submissionAttempts === 1 ? "" : "s"} · {i.verification.correctionAttempts} corrective attempt{i.verification.correctionAttempts === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                This checks consistency, not independent market truth, legal permission or structural suitability.
                Per-claim verdicts and correction reasons are not reported.
              </p>
            </>
          ) : (
            <p className="mt-1 text-slate-800">Not reported for this run. No verification or correction is claimed.</p>
          )}
          <p className="mt-1 text-xs text-slate-600">Financial figures come from the deterministic calculator and are shown unchanged.</p>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <DataModeBadge mode={i.dataMode} prefix="Run data" />
        <span>
          Model {i.model.id} ({i.model.provider}){i.model.fallbackUsed ? " — fallback model used" : ""} ·{" "}
          {i.model.attempts} model {i.model.attempts === 1 ? "attempt" : "attempts"} · {i.elapsedMs} ms
        </span>
        <span>
          Request <code>{i.requestId}</code>
        </span>
      </p>
    </section>
  );
}
