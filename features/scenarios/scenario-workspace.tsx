"use client";

import { useMemo, useReducer, useState, type KeyboardEvent } from "react";
import { Calculator, Plus } from "lucide-react";
import type { ComparisonResponseDTO, ComparisonRequestDTO, PropertyDTO } from "@/lib/contracts";
import type { Load } from "@/features/dashboard/state";
import { Button } from "@/components/ui/button";
import { DataModeBadge, Pill } from "@/components/kestrel/badges";
import { ErrorPanel, LoadingPanel } from "@/components/kestrel/state-panels";
import { ConstraintsFormView } from "./constraints-form";
import { ComparisonView } from "./comparison-view";
import { ScenarioFormView } from "./scenario-form";
import { canAddAlternative, canRemoveAlternative, editorReducer, type EditorAction } from "./editor-state";
import { initialModel, problemCount, propertyProposals, validateModel } from "./model";

/**
 * Baseline + alternatives editor with a deterministic comparison. The property
 * is the React key of this component, so switching property discards drafts.
 * It never calculates anything: it submits validated drafts through onCompare
 * and renders what the server returns.
 */
export function ScenarioWorkspace({
  property,
  inputRevision,
  compare,
  stale,
  onEdited,
  onCompare,
  onCancel,
}: {
  property: PropertyDTO;
  inputRevision: number;
  compare: Load<ComparisonResponseDTO>;
  stale: boolean;
  onEdited: () => void;
  onCompare: (request: ComparisonRequestDTO) => void;
  onCancel: () => void;
}) {
  const [model, dispatch] = useReducer(editorReducer, undefined, () =>
    initialModel(property, new Date().getFullYear()),
  );
  const [activeId, setActiveId] = useState("baseline");
  const [attempted, setAttempted] = useState(false);
  const validation = useMemo(
    () => validateModel(model, property.id, inputRevision),
    [model, property.id, inputRevision],
  );
  const proposals = useMemo(() => propertyProposals(property), [property]);
  const active = model.scenarios.find((s) => s.id === activeId) ?? model.scenarios[0];
  const totalProblems = Object.keys(validation.fieldErrors).length + validation.formErrors.length;
  const loading = compare.status === "loading";

  function edit(action: EditorAction) {
    dispatch(action);
    onEdited(); // every edit advances the input revision and stales old results
  }

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = model.scenarios.findIndex((s) => s.id === active.id);
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + model.scenarios.length) % model.scenarios.length;
    setActiveId(model.scenarios[next].id);
    document.getElementById(`tab-${model.scenarios[next].id}`)?.focus();
  }

  function submit() {
    if (!validation.request) {
      setAttempted(true);
      const firstBad = model.scenarios.find((s) => problemCount(validation, s.id) > 0);
      if (firstBad) setActiveId(firstBad.id);
      return;
    }
    setAttempted(false);
    onCompare(validation.request);
  }

  return (
    <section
      aria-labelledby="scenarios-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="scenarios-heading" className="text-lg font-semibold text-slate-900">
          Scenarios
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {property.dataMode === "synthetic" ? <DataModeBadge mode="synthetic" prefix="Property data" /> : null}
          <Pill>Input revision {inputRevision}</Pill>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Compare the current use with at least two alternatives. Unknown values
        stay unknown. Drafts live in this browser tab only and are lost on
        reload or when you switch property.
      </p>

      <div className="mt-4 space-y-4">
        <ConstraintsFormView
          constraints={model.constraints}
          validation={validation}
          onPatch={(patch) => edit({ type: "patch_constraints", patch })}
        />

        <div>
          <div
            role="tablist"
            aria-label="Scenarios"
            onKeyDown={onTabKey}
            className="flex flex-wrap items-center gap-1 border-b border-slate-200"
          >
            {model.scenarios.map((s) => {
              const n = problemCount(validation, s.id);
              const selected = s.id === active.id;
              return (
                <button
                  key={s.id}
                  id={`tab-${s.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${s.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(s.id)}
                  className={
                    "-mb-px rounded-t-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-600 " +
                    (selected
                      ? "border-slate-200 border-b-white bg-white font-semibold text-slate-900"
                      : "border-transparent text-slate-700 hover:bg-slate-100")
                  }
                >
                  {s.name || (s.role === "baseline" ? "Baseline" : "Alternative")}
                  {s.role === "baseline" ? <span className="ml-1 text-xs text-slate-600">(baseline)</span> : null}
                  {n > 0 ? (
                    <span className="ml-2 rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-800">
                      <span className="sr-only">{n} problems</span>
                      <span aria-hidden>{n}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                edit({ type: "add_alternative" });
              }}
              disabled={!canAddAlternative(model)}
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-sky-800 hover:bg-sky-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-600"
            >
              <Plus className="size-4" aria-hidden /> Add alternative
            </button>
          </div>
          <div
            role="tabpanel"
            id={`panel-${active.id}`}
            aria-labelledby={`tab-${active.id}`}
            className="pt-4"
          >
            <ScenarioFormView
              scenario={active}
              validation={validation}
              proposals={proposals}
              year={model.year}
              onPatch={(patch) => edit({ type: "patch_scenario", id: active.id, patch })}
              onRemove={
                canRemoveAlternative(model, active.id)
                  ? () => {
                      setActiveId("baseline");
                      edit({ type: "remove_alternative", id: active.id });
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {attempted && totalProblems > 0 ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900" data-testid="validation-summary">
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
          <Button
            type="button"
            className="bg-slate-900 text-white hover:bg-slate-700"
            disabled={loading}
            onClick={submit}
          >
            <Calculator aria-hidden />
            {compare.status === "ready" ? "Recalculate" : "Calculate comparison"}
          </Button>
          <p className="text-xs text-slate-600">
            {totalProblems > 0
              ? `${totalProblems} ${totalProblems === 1 ? "problem" : "problems"} to fix first.`
              : "Sends your drafts to the server's deterministic comparison; no AI call is made."}
          </p>
        </div>
      </div>

      <div className="mt-6" aria-live="polite">
        {compare.status === "idle" ? (
          <p className="text-sm text-slate-700">No comparison has been calculated yet.</p>
        ) : null}
        {loading ? <LoadingPanel label="Calculating comparison…" rows={4} onCancel={onCancel} /> : null}
        {compare.status === "error" ? (
          <ErrorPanel what="Comparison" error={compare.error} onRetry={submit} />
        ) : null}
        {compare.status === "ready" ? <ComparisonView response={compare.data} stale={stale} /> : null}
      </div>
    </section>
  );
}
