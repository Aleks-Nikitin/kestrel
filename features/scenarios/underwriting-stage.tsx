"use client";

import type { KeyboardEvent } from "react";
import { Calculator, FlaskConical, Plus } from "lucide-react";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
import { buttonPrimary, buttonQuiet } from "@/components/kestrel/state-panels";
import { ILLUSTRATIVE_EXAMPLE_DISCLOSURE, ILLUSTRATIVE_EXAMPLE_LABEL } from "@/lib/scenarios/illustrative-example";
import { ConstraintsFormView } from "./constraints-form";
import { ScenarioFormView } from "./scenario-form";
import { canAddAlternative, canRemoveAlternative } from "./editor-state";
import { problemCount } from "./model";
import type { ScenarioEditor } from "./use-editor";

/**
 * Baseline + alternatives editor. It never calculates anything: it edits the
 * shared drafts and asks the dashboard to submit them.
 */
export function UnderwritingStage({
  hidden,
  editor,
  inputRevision,
  hasResult,
  calculating,
  onCalculate,
}: {
  hidden: boolean;
  editor: ScenarioEditor;
  inputRevision: number;
  hasResult: boolean;
  calculating: boolean;
  onCalculate: () => void;
}) {
  const { model, validation, ready, active, property, totalProblems } = editor;

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = model.scenarios.findIndex((s) => s.id === active.id);
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + model.scenarios.length) % model.scenarios.length;
    editor.setActiveId(model.scenarios[next].id);
    document.getElementById(`tab-${model.scenarios[next].id}`)?.focus();
  }

  return (
    <section id="underwriting" hidden={hidden} aria-labelledby="underwriting-heading" className="stage-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-500">{property.address.value ?? "Selected property"}</p>
          <h2 id="underwriting-heading" tabIndex={-1} className="type-display mt-1 text-4xl text-ink-950 outline-none sm:text-5xl">
            Underwriting
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {property.dataMode === "synthetic" ? <DataModeBadge mode="synthetic" prefix="Property data" /> : null}
          <Pill>Input revision {inputRevision}</Pill>
        </div>
      </header>

      <div className="space-y-4 rounded-xl border border-ink-200 bg-white p-4 sm:p-6">
        <div className="rounded-lg border border-rufous-200 bg-rufous-50 p-4" data-testid="illustrative-example">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonQuiet} onClick={editor.loadExample}>
              <FlaskConical className="size-4" aria-hidden /> {ILLUSTRATIVE_EXAMPLE_LABEL}
            </button>
            <p className="min-w-0 flex-1 text-xs text-ink-700">
              Fills the baseline, both alternatives and the constraints so you can try the comparison. It does not
              calculate or run the analyst; you choose when.
            </p>
          </div>
          <p className="mt-2 text-xs text-ink-700" data-testid="illustrative-disclosure">
            {ILLUSTRATIVE_EXAMPLE_DISCLOSURE}
          </p>
          {editor.loadError ? (
            <p role="alert" data-testid="illustrative-error" className="mt-2 rounded-md bg-ochre-100 p-2 text-xs font-medium text-ochre-800">
              {editor.loadError} Your current drafts are unchanged.
            </p>
          ) : null}
          {editor.pendingLoad ? (
            <div role="alert" data-testid="illustrative-confirm" className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-white p-2 text-xs text-ink-800">
              <span className="flex-1">You have edited these drafts. Replace all scenarios and constraints with the illustrative example?</span>
              <button type="button" className={buttonPrimary} onClick={editor.confirmLoad}>Replace drafts</button>
              <button type="button" className={buttonQuiet} onClick={editor.cancelLoad}>Keep my drafts</button>
            </div>
          ) : null}
        </div>
        <ConstraintsFormView
          constraints={model.constraints}
          validation={validation}
          need={ready.constraints}
          onPatch={(patch) => editor.edit({ type: "patch_constraints", patch })}
        />

        <div>
          <div role="tablist" aria-label="Scenarios" onKeyDown={onTabKey} className="flex flex-wrap items-center gap-1 border-b border-ink-200">
            {model.scenarios.map((s) => {
              const n = problemCount(validation, s.id);
              const selected = s.id === active.id;
              const open = Object.keys(ready.byScenario[s.id] ?? {}).length;
              return (
                <button
                  key={s.id}
                  id={`tab-${s.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${s.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => editor.setActiveId(s.id)}
                  className={
                    "-mb-px rounded-t-md border px-3 py-2 text-sm " +
                    (selected
                      ? "border-ink-200 border-b-white border-t-2 border-t-rufous-600 bg-white font-semibold text-ink-900"
                      : "border-transparent text-ink-700 hover:bg-ink-100")
                  }
                >
                  {s.name || (s.role === "baseline" ? "Baseline" : "Alternative")}
                  {s.role === "baseline" ? <span className="ml-1 text-xs text-ink-600">(baseline)</span> : null}
                  {n === 0 && open > 0 ? (
                    <span className="ml-2 rounded-full bg-ochre-100 px-1.5 text-xs font-medium text-ochre-800">
                      <span className="sr-only">{open} inputs still needed for a recommendation</span>
                      <span aria-hidden>{open} needed</span>
                    </span>
                  ) : null}
                  {n > 0 ? (
                    <span className="ml-2 rounded-full bg-brick-100 px-1.5 text-xs font-medium text-brick-800">
                      <span className="sr-only">{n} problems</span>
                      <span aria-hidden>{n}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => editor.edit({ type: "add_alternative" })}
              disabled={!canAddAlternative(model)}
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-ink-800 hover:bg-ink-50 disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden /> Add alternative
            </button>
          </div>
          <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`} className="pt-4">
            <ScenarioFormView
              scenario={active}
              validation={validation}
              needs={ready.byScenario[active.id]}
              proposals={editor.proposals}
              year={model.year}
              onPatch={(patch) => editor.edit({ type: "patch_scenario", id: active.id, patch })}
              onRemove={
                canRemoveAlternative(model, active.id)
                  ? () => {
                      const id = active.id;
                      editor.setActiveId("baseline");
                      editor.edit({ type: "remove_alternative", id });
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {editor.attempted && totalProblems > 0 ? (
          <div role="alert" className="rounded-lg border border-brick-300 bg-brick-50 p-3 text-sm text-brick-800" data-testid="validation-summary">
            <p className="font-semibold">
              Fix {totalProblems} {totalProblems === 1 ? "problem" : "problems"} before recalculating.
            </p>
            <p className="mt-0.5">The request was not sent. Problems are marked on each scenario tab.</p>
            {validation.formErrors.length ? (
              <ul className="mt-1 list-disc pl-5">
                {validation.formErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonPrimary} disabled={calculating} onClick={onCalculate}>
            <Calculator className="size-4" aria-hidden />
            {hasResult ? "Recalculate" : "Calculate comparison"}
          </button>
          <p className="text-xs text-ink-600">
            {totalProblems > 0
              ? `${totalProblems} ${totalProblems === 1 ? "problem" : "problems"} to fix first.`
              : "Sends your drafts to the server's deterministic comparison; no AI call is made."}
          </p>
        </div>
        {ready.total > 0 ? (
          <div data-testid="readiness-summary" className="rounded-md border border-ochre-300 bg-ochre-50 p-3 text-sm text-ochre-800">
            <p><strong>You can calculate a partial comparison now.</strong>{" "}
              For a conditional recommendation, complete the needed income and alternative investment assumptions,
              and set at least one capital or return constraint. Unknown values stay unavailable.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium underline underline-offset-2">Review {ready.total} scenario-input gaps</summary>
              <p className="mt-2 text-xs">
                This counts editable entries and choices across {model.scenarios.length} separate financial scenarios
                {ready.constraints ? ", plus an unset investment constraint" : ""}. It does not count missing property records, legal verification
                or spatial measurements. Look for the <em>Needed</em> marks; source evidence and due diligence remain separate.
              </p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {model.scenarios.map(s => <li key={s.id}>{s.name}: {Object.keys(ready.byScenario[s.id]).length} input gaps</li>)}
                {ready.constraints ? <li>Investment constraints: choose at least one capital or return limit</li> : null}
              </ul>
            </details>
          </div>
        ) : null}
      </div>
    </section>
  );
}
