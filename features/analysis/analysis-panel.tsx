"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { AnalysisRequestDTO, ComparisonRequestDTO } from "@/lib/contracts";
import type { Load } from "@/features/dashboard/state";
import type { AnalysisResponseDTO } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { DataModeBadge } from "@/components/kestrel/badges";
import { ErrorPanel, LoadingPanel } from "@/components/kestrel/state-panels";
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
  request,
  problems,
  analysis,
  action: shownAction,
  stale,
  onRun,
  onCancel,
}: {
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
    const h = document.getElementById("scenarios-heading");
    h?.scrollIntoView({ block: "start" });
    h?.focus();
  }

  return (
    <section
      id="section-analysis"
      aria-labelledby="analysis-heading"
      className="scroll-mt-16 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="analysis-heading" className="text-lg font-semibold">
          Analysis
        </h2>
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
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Sends the scenarios and constraints from the editor above, exactly as
        entered, to the server. Calculations are deterministic; the agent only
        explains them. Unknown values stay unknown.
      </p>

      <div role="group" aria-label="Analysis actions" className="mt-4 flex flex-wrap gap-2">
        {ACTIONS.map((a) => {
          const active = shownAction === a.id && analysis.status !== "idle";
          return (
            <Button
              key={a.id}
              type="button"
              size="sm"
              variant={a.id === "analyze" ? "default" : "outline"}
              className={a.id === "analyze" ? "bg-slate-900 text-white hover:bg-slate-700" : undefined}
              disabled={loading || !!blocks[a.id]}
              aria-pressed={active}
              title={a.hint}
              onClick={() => run(a.id)}
            >
              {a.id === "analyze" ? <Play aria-hidden /> : null}
              {a.label}
            </Button>
          );
        })}
      </div>
      {allBlocked && firstBlock ? (
        <p className="mt-2 text-xs text-amber-900" data-testid="action-blocked">
          {firstBlock}
        </p>
      ) : !loading && ACTIONS.some((a) => blocks[a.id]) ? (
        <p className="mt-2 text-xs text-amber-900" data-testid="action-blocked">
          {ACTIONS.filter((a) => blocks[a.id])
            .map((a) => `${a.label}: ${blocks[a.id]}`)
            .join(" ")}
        </p>
      ) : null}

      <div className="mt-3">
        <label htmlFor="analysis-question" className="text-sm font-medium text-slate-800">
          Question for the analyst <span className="font-normal text-slate-600">(optional)</span>
        </label>
        <textarea
          id="analysis-question"
          rows={2}
          value={question}
          maxLength={QUESTION_MAX}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="For example: why does the preferred option beat the baseline?"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 sm:text-sm focus-visible:outline-2 focus-visible:outline-sky-600"
        />
        <p className="mt-0.5 text-xs text-slate-600">
          Sent with whichever action you choose. Leave empty to use the actions alone.
        </p>
      </div>

      <div className="mt-4" aria-live="polite">
        {analysis.status === "idle" ? (
          <p className="text-sm text-slate-700">No analysis has been run yet.</p>
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
              <p className="text-sm text-slate-800" data-testid="ai-unavailable">
                The AI explanation is unavailable right now. The deterministic
                comparison in the Scenarios section above does not depend on it
                and still works.
              </p>
            ) : null}
          </div>
        ) : null}
        {analysis.status === "ready" ? (
          <div className="space-y-3">
            {shownAction ? (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                Action: {ACTION_LABEL[shownAction]}
              </p>
            ) : null}
            <AnalysisResult response={analysis.data} stale={stale} />
            {analysis.data.status === "needs_input" ? (
              <Button type="button" size="sm" variant="outline" onClick={editInputs}>
                Edit scenario inputs
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
