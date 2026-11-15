"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { AnalysisRequestDTO, ComparisonRequestDTO } from "@/lib/contracts";
import type { Load } from "@/features/dashboard/state";
import type { AnalysisResponseDTO } from "@/lib/contracts";
import { DataModeBadge } from "@/components/kestrel/badges";
import { ErrorPanel, LoadingPanel, buttonPrimary, buttonQuiet } from "@/components/kestrel/state-panels";
import { goToStage } from "@/features/dashboard/stages";
import { AnalysisResult } from "./analysis-result";
import {
  ACTIONS,
  ACTION_LABEL,
  QUESTION_MAX,
  actionBlock,
  buildAnalysisRequest,
  type AnalysisAction,
} from "./actions";

/**
 * Action-driven analysis. No typed prompt is required: each button sends the
 * editor's validated scenarios and constraints with one contract action. The
 * progress shown is only what the server reports after it responds.
 */
export function AnalysisPanel({
  hidden,
  address,
  request,
  problems,
  analysis,
  action: shownAction,
  stale,
  onRun,
  onCancel,
}: {
  hidden: boolean;
  address: string;
  request: ComparisonRequestDTO | null;
  problems: number;
  analysis: Load<AnalysisResponseDTO>;
  action: AnalysisAction | null;
  stale: boolean;
  onRun: (request: AnalysisRequestDTO) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState("");
  const loading = analysis.status === "loading";
  const blocks = Object.fromEntries(
    ACTIONS.map((a) => [a.id, actionBlock(request, problems, a.id, question)]),
  ) as Record<AnalysisAction, string | null>;
  const firstBlock = ACTIONS.map((a) => blocks[a.id]).find(Boolean) ?? null;
  const allBlocked = ACTIONS.every((a) => blocks[a.id]);

  function run(action: AnalysisAction) {
    if (!request || blocks[action]) return;
    onRun(buildAnalysisRequest(request, action, question));
  }

  function editInputs() {
    goToStage("underwriting");
  }

  return (
    <section id="investigation" hidden={hidden} aria-labelledby="investigation-heading" className="stage-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-500">{address}</p>
          <h2 id="investigation-heading" tabIndex={-1} className="type-display mt-1 text-4xl text-ink-950 outline-none sm:text-5xl">
            Investigation
          </h2>
        </div>
        {analysis.status === "ready" ? (
          <DataModeBadge
            mode={
              analysis.data.status === "complete"
                ? analysis.data.execution.dataMode
                : analysis.data.property.dataMode
            }
            prefix="Result"
          />
        ) : null}
      </header>
      <div className="rounded-xl border border-ink-200 bg-white">
        <div className="grid gap-x-8 gap-y-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <p className="font-serif text-xl leading-snug text-ink-950">
              Ask the analyst to investigate the comparison and report back with its sources.
            </p>
            <p className="mt-2 max-w-prose text-[13px] leading-5 text-ink-600">
              Sends the scenarios and constraints from Underwriting, exactly as
              entered, to the server. Calculations are deterministic; the agent only
              explains them. Unknown values stay unknown. Nothing runs until you choose an action.
            </p>
            <div role="group" aria-label="Analysis actions" className="mt-4 flex flex-wrap gap-2">
              {ACTIONS.map((a) => {
                const active = shownAction === a.id && analysis.status !== "idle";
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={a.id === "analyze" ? buttonPrimary : buttonQuiet + " min-h-10"}
                    disabled={loading || !!blocks[a.id]}
                    aria-pressed={active}
                    title={a.hint}
                    onClick={() => run(a.id)}
                  >
                    {a.id === "analyze" ? <Play className="size-4" aria-hidden /> : null}
                    {a.label}
                  </button>
                );
              })}
            </div>
            {allBlocked && firstBlock ? (
              <p className="mt-2 text-xs text-ochre-700" data-testid="action-blocked">
                {firstBlock}
              </p>
            ) : !loading && ACTIONS.some((a) => blocks[a.id]) ? (
              <p className="mt-2 text-xs text-ochre-700" data-testid="action-blocked">
                {ACTIONS.filter((a) => blocks[a.id])
                  .map((a) => `${a.label}: ${blocks[a.id]}`)
                  .join(" ")}
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label htmlFor="analysis-question" className="text-sm font-medium text-ink-900">
              Question for the analyst <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <textarea
              id="analysis-question"
              rows={4}
              value={question}
              maxLength={QUESTION_MAX}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="For example: why does the preferred option beat the baseline?"
              className="mt-1 block w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-base leading-relaxed text-ink-950 placeholder:text-ink-400 hover:border-ink-500 focus-visible:outline-offset-0 sm:text-[15px]"
            />
            <p className="mt-1 text-xs text-ink-500">
              Sent with whichever action you choose. Leave empty to use the actions alone.
            </p>
          </div>
        </div>
      </div>

      <div aria-live="polite">
        {analysis.status === "idle" ? (
          <p className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center text-sm text-ink-600">No analysis has been run yet.</p>
        ) : null}
        {loading ? (
          <LoadingPanel
            label={`Running ${shownAction ? ACTION_LABEL[shownAction].toLowerCase() : "analysis"}…`}
            rows={4}
            onCancel={onCancel}
          />
        ) : null}
        {analysis.status === "error" ? (
          <div className="space-y-2">
            <ErrorPanel
              what="Analysis"
              error={analysis.error}
              onRetry={shownAction ? () => run(shownAction) : undefined}
            />
            {analysis.error.code === "ANALYSIS_UNAVAILABLE" ? (
              <p className="text-sm text-ink-800" data-testid="ai-unavailable">
                The AI explanation is unavailable right now. The deterministic
                comparison in the Comparison stage does not depend on it
                and still works.
              </p>
            ) : null}
          </div>
        ) : null}
        {analysis.status === "ready" ? (
          <div className="space-y-3">
            <AnalysisResult response={analysis.data} stale={stale} action={shownAction} />
            {analysis.data.status === "needs_input" && !stale ? (
              <button type="button" className={buttonQuiet} onClick={editInputs}>
                Edit scenario inputs
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
