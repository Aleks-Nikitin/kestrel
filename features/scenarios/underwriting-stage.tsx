"use client";

import type { KeyboardEvent } from "react";
import { Calculator, Check, FlaskConical, Plus } from "lucide-react";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
import { Segmented } from "@/components/kestrel/field";
import { buttonPrimary, buttonQuiet } from "@/components/kestrel/state-panels";
import { ILLUSTRATIVE_EXAMPLE_DISCLOSURE, ILLUSTRATIVE_EXAMPLE_LABEL } from "@/lib/scenarios/illustrative-example";
import { cn } from "@/lib/utils";
import { ConstraintsFormView } from "./constraints-form";
import { QuickFormView } from "./quick-form";
import { ScenarioFormView } from "./scenario-form";
import { canAddAlternative, canRemoveAlternative } from "./editor-state";
import { problemCount, type ScenarioForm } from "./model";
import type { Needs } from "./readiness";
import type { EditorMode, ScenarioEditor } from "./use-editor";

const isCapital = (key: string) => key.startsWith("capex.") || key.startsWith("totalProjectCost");

/** What the engine can already work out for one scenario, from the same readiness rules the server enforces. */
function Coverage({ scenario: s, needs }: { scenario: ScenarioForm; needs: Needs }) {
  const keys = Object.keys(needs);
  const income = keys.filter((k) => !isCapital(k)).length;
  const capital = keys.filter(isCapital).length;
  const line = (label: string, open: number, fixed?: string) => (
    <li className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-2 text-ink-700">
        {open === 0 ? (
          <Check className="size-3.5 shrink-0 text-spruce-600" strokeWidth={3} aria-hidden />
        ) : (
          <span aria-hidden className="mx-[3px] size-2 shrink-0 rounded-full border border-ink-400" />
        )}
        {label}
      </span>
      <span className={cn("figure text-xs", open === 0 ? "text-spruce-700" : "text-ink-500")}>
        {open === 0 ? (fixed ?? "Can be calculated") : `${open} ${open === 1 ? "input" : "inputs"} open`}
      </span>
    </li>
  );
  return (
    <div>
      <p className="truncate text-[13px] font-semibold text-ink-950">{s.name || (s.role === "baseline" ? "Baseline" : "Alternative")}</p>
      <ul className="mt-1 space-y-1 text-[13px]">
        {line("Income and NOI", income)}
        {s.role === "baseline" ? line("Investment", 0, "Fixed at $0") : line("Investment and payback", capital)}
      </ul>
    </div>
  );
}

/**
 * Underwriting: the baseline and alternatives, in two views of one model.
 * Quick Analysis is the default and shows the few inputs that matter most;
 * Advanced Underwriting shows all of them. Switching changes the view only.
 * Nothing here calculates: it edits the shared drafts and asks the dashboard
 * to submit them.
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
  const { model, validation, ready, active, property, totalProblems, mode } = editor;
  const advanced = mode === "advanced";

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = model.scenarios.findIndex((s) => s.id === active.id);
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + model.scenarios.length) % model.scenarios.length;
    editor.setActiveId(model.scenarios[next].id);
    document.getElementById(`tab-${model.scenarios[next].id}`)?.focus();
  }
  const patchScenario = (patch: Partial<ScenarioForm>) => editor.edit({ type: "patch_scenario", id: active.id, patch });

  return (
    <section id="underwriting" hidden={hidden} aria-labelledby="underwriting-heading" className="stage-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-500">{property.address.value ?? "Selected property"}</p>
          <h2 id="underwriting-heading" tabIndex={-1} className="type-display mt-1 text-4xl text-ink-950 outline-none sm:text-5xl">
            Underwriting
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {property.dataMode === "synthetic" ? <DataModeBadge mode="synthetic" prefix="Property data" /> : null}
          <Pill>Input revision {inputRevision}</Pill>
          <Segmented<EditorMode>
            legend="Underwriting view"
            name="underwriting-mode"
            value={mode}
            onChange={editor.setMode}
            options={[
              { value: "quick", label: "Quick Analysis" },
              { value: "advanced", label: "Advanced Underwriting" },
            ]}
          />
        </div>
      </header>

      <div className="survey-grid overflow-hidden rounded-xl bg-ink-900 text-white" data-testid="illustrative-example">
        <div className="grid items-center gap-x-8 gap-y-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="type-display text-3xl text-buff-100">
              {advanced ? "Every input, grouped the way a deal is underwritten." : "Start with a worked example, then make it yours."}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-200">
              {advanced
                ? "Advanced Underwriting edits the same drafts as Quick Analysis. Nothing is reset when you switch, and empty fields stay unknown."
                : "The example fills a baseline, two alternatives and your limits with clearly labeled hypothetical assumptions. It does not calculate or run the analyst; you choose when."}
            </p>
          </div>
          <button type="button" className={cn(buttonPrimary, "min-h-12 px-5 text-[15px] focus-visible:outline-buff-200")} onClick={editor.loadExample}>
            <FlaskConical className="size-4" aria-hidden /> {ILLUSTRATIVE_EXAMPLE_LABEL}
          </button>
        </div>
        {editor.loadError ? (
          <p role="alert" data-testid="illustrative-error" className="border-t border-white/10 bg-ochre-100 px-5 py-2.5 text-[13px] font-medium text-ochre-800 sm:px-6">
            {editor.loadError} Your current drafts are unchanged.
          </p>
        ) : null}
        {editor.pendingLoad ? (
          <div role="alert" data-testid="illustrative-confirm" className="flex flex-wrap items-center gap-2.5 border-t border-white/10 bg-white px-5 py-3 text-sm text-ink-900 sm:px-6">
            <span className="min-w-0 flex-1">You have edited these drafts. Replace all scenarios and constraints with the illustrative example?</span>
            <button type="button" className={buttonPrimary} onClick={editor.confirmLoad}>Replace drafts</button>
            <button type="button" className={buttonQuiet} onClick={editor.cancelLoad}>Keep my drafts</button>
          </div>
        ) : null}
        <p className="border-t border-white/10 px-5 py-2.5 text-xs leading-5 text-ink-300 sm:px-6" data-testid="illustrative-disclosure">
          {ILLUSTRATIVE_EXAMPLE_DISCLOSURE}
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <div role="tablist" aria-label="Scenarios" onKeyDown={onTabKey} className="flex flex-wrap items-stretch gap-2">
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
                  className={cn(
                    "min-w-40 flex-1 cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors sm:flex-none sm:basis-56",
                    selected ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-900 hover:border-ink-500",
                  )}
                >
                  <span className="block text-[15px] font-semibold leading-tight">
                    {s.name || (s.role === "baseline" ? "Baseline" : "Alternative")}
                    {s.role === "baseline" && !/baseline/i.test(s.name) ? <span className={cn("ml-1 text-xs font-normal", selected ? "text-ink-300" : "text-ink-500")}>(baseline)</span> : null}
                  </span>
                  <span className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-xs", selected ? "text-ink-300" : "text-ink-500")}>
                    <span className="truncate">{s.proposedUse.trim() || "Use not set"}</span>
                    {n === 0 && open > 0 ? (
                      <span className="figure whitespace-nowrap">
                        <span className="sr-only">{open} inputs still needed for a recommendation</span>
                        <span aria-hidden>· {open} open</span>
                      </span>
                    ) : null}
                    {n > 0 ? (
                      <span className={cn("figure whitespace-nowrap rounded-[4px] px-1.5 font-semibold", selected ? "bg-brick-300 text-brick-800" : "bg-brick-100 text-brick-800")}>
                        {n}<span className="sr-only"> problems</span><span aria-hidden> to fix</span>
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => editor.edit({ type: "add_alternative" })}
              disabled={!canAddAlternative(model)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-ink-300 px-4 text-sm font-medium text-ink-700 hover:border-ink-500 hover:text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden /> Add alternative
            </button>
          </div>

          <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
            {advanced ? (
              <ScenarioFormView
                scenario={active}
                validation={validation}
                needs={ready.byScenario[active.id]}
                proposals={editor.proposals}
                year={model.year}
                onPatch={patchScenario}
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
            ) : (
              <QuickFormView
                scenario={active}
                validation={validation}
                needs={ready.byScenario[active.id]}
                proposals={editor.proposals}
                onPatch={patchScenario}
                onEditAll={() => editor.setMode("advanced")}
              />
            )}
          </div>
        </div>

        <aside aria-label="Limits and readiness" className="min-w-0 space-y-4 xl:sticky xl:top-20">
          <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
            <ConstraintsFormView
              constraints={model.constraints}
              validation={validation}
              need={ready.constraints}
              advanced={advanced}
              onPatch={(patch) => editor.edit({ type: "patch_constraints", patch })}
            />
          </div>

          <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
            <h3 className="text-base font-semibold text-ink-950">What can be calculated now</h3>
            <div className="mt-3 space-y-3">
              {model.scenarios.map((s) => (
                <Coverage key={s.id} scenario={s} needs={ready.byScenario[s.id] ?? {}} />
              ))}
            </div>
            {ready.total > 0 ? (
              <div data-testid="readiness-summary" className="mt-4 border-t border-ink-100 pt-3 text-[13px] leading-5 text-ink-700">
                <p>
                  <strong className="font-semibold text-ink-950">You can calculate a partial comparison now.</strong>{" "}
                  Anything that depends on an open input comes back marked unavailable; nothing is guessed. For a
                  conditional recommendation, complete the income and investment inputs and set at least one limit.
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium text-ink-900 underline underline-offset-4">Review {ready.total} scenario-input gaps</summary>
                  <p className="mt-2 text-xs">
                    This counts editable entries and choices across {model.scenarios.length} separate financial scenarios
                    {ready.constraints ? ", plus an unset investment constraint" : ""}. It does not count missing property records, legal verification
                    or spatial measurements. Open inputs are marked in Advanced Underwriting; source evidence and due diligence remain separate.
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {model.scenarios.map(s => <li key={s.id}>{s.name}: {Object.keys(ready.byScenario[s.id]).length} input gaps</li>)}
                    {ready.constraints ? <li>Investment constraints: choose at least one capital or return limit</li> : null}
                  </ul>
                </details>
              </div>
            ) : (
              <p className="mt-4 border-t border-ink-100 pt-3 text-[13px] leading-5 text-spruce-700" data-testid="readiness-complete">
                Every input the comparison needs is set.
              </p>
            )}
          </div>

          {editor.attempted && totalProblems > 0 ? (
            <div role="alert" className="rounded-xl border border-brick-300 bg-brick-50 p-4 text-sm text-brick-800" data-testid="validation-summary">
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

          <div>
            <button type="button" className={cn(buttonPrimary, "min-h-12 w-full text-[15px]")} disabled={calculating} onClick={onCalculate}>
              <Calculator className="size-4" aria-hidden />
              {hasResult ? "Recalculate" : "Calculate comparison"}
            </button>
            <p className="mt-2 text-xs leading-5 text-ink-600">
              {totalProblems > 0
                ? `${totalProblems} ${totalProblems === 1 ? "problem" : "problems"} to fix first.`
                : "Sends your drafts to the server's deterministic comparison; no AI call is made."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
