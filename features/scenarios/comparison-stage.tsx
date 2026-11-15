"use client";

import { useState } from "react";
import { ArrowRight, Calculator } from "lucide-react";
import type { ComparisonRequestDTO, ComparisonResponseDTO } from "@/lib/contracts";
import type { Load } from "@/features/dashboard/state";
import { ErrorPanel, LoadingPanel, buttonInk, buttonPrimary } from "@/components/kestrel/state-panels";
import { ComparisonView } from "./comparison-view";

/**
 * The deterministic comparison, as its own stage. It renders what the server
 * returned and nothing else; `onCalculate` re-submits the current drafts.
 */
export function ComparisonStage({
  hidden,
  address,
  compare,
  submitted,
  stale,
  problems,
  openInputs,
  onCalculate,
  onCancel,
}: {
  hidden: boolean;
  address: string;
  compare: Load<ComparisonResponseDTO>;
  /** The request most recently submitted; its limits are shown only beside the result that answers it. */
  submitted: ComparisonRequestDTO | null;
  stale: boolean;
  problems: number;
  /** Inputs the engine still needs for a full recommendation (never a blocker). */
  openInputs: number;
  onCalculate: () => void;
  onCancel: () => void;
}) {
  // The previous successful result, kept only to state what changed after a recalculation.
  const [seen, setSeen] = useState<ComparisonResponseDTO | null>(null);
  const [prevResponse, setPrevResponse] = useState<ComparisonResponseDTO | null>(null);
  if (compare.status === "ready" && compare.data !== seen) {
    setPrevResponse(seen);
    setSeen(compare.data);
  }
  const loading = compare.status === "loading";
  return (
    <section id="comparison" hidden={hidden} aria-labelledby="comparison-heading" className="stage-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-500">{address}</p>
          <h2 id="comparison-heading" tabIndex={-1} className="type-display mt-1 text-4xl text-ink-950 outline-none sm:text-5xl">
            Comparison
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className={compare.status === "ready" && !stale ? buttonInk : buttonPrimary} disabled={loading} onClick={onCalculate}>
            <Calculator className="size-4" aria-hidden />
            {compare.status === "ready" ? "Recalculate" : "Calculate comparison"}
          </button>
          {compare.status === "ready" && !stale ? (
            <a href="#investigation" className={buttonPrimary}>
              Investigate with the analyst <ArrowRight className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </header>

      <div aria-live="polite" className="space-y-5">
        {compare.status === "idle" ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center">
            <p className="type-display text-2xl text-ink-900">No comparison has been calculated yet.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-ink-600">
              {problems > 0
                ? `${problems} ${problems === 1 ? "input needs" : "inputs need"} fixing in Underwriting before the drafts can be sent.`
                : openInputs > 0
                  ? "Your drafts can be sent as they are. Figures that depend on a missing input come back marked unavailable rather than guessed."
                  : "Your drafts are complete. The server calculates every figure; no AI call is made."}
            </p>
            <a href="#underwriting" className="mt-4 inline-flex text-sm font-semibold text-rufous-700 underline underline-offset-4">
              Review the scenarios
            </a>
          </div>
        ) : null}
        {loading ? <LoadingPanel label="Calculating comparison…" rows={4} onCancel={onCancel} /> : null}
        {compare.status === "error" ? <ErrorPanel what="Comparison" error={compare.error} onRetry={onCalculate} /> : null}
        {compare.status === "ready" ? <ComparisonView
            response={compare.data}
            stale={stale}
            previous={prevResponse}
            constraints={
              submitted && submitted.propertyId === compare.data.propertyId && submitted.inputRevision === compare.data.inputRevision
                ? submitted.constraints
                : null
            }
          /> : null}
      </div>
    </section>
  );
}
