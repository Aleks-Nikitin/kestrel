"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Play } from "lucide-react";
import { apiClient } from "@/lib/contracts/client";
import { Button } from "@/components/ui/button";
import { DataModeBadge } from "@/components/kestrel/badges";
import { ErrorPanel, LoadingPanel } from "@/components/kestrel/state-panels";
import { SyntheticBanner } from "@/components/kestrel/synthetic-banner";
import { PropertyList } from "@/features/property/property-list";
import { PropertyPanel } from "@/features/property/property-panel";
import { SpatialPanel } from "@/features/property/spatial-panel";
import { AnalysisResult } from "@/features/analysis/analysis-result";
import { analysisRequest } from "./draft";
import {
  hasSyntheticData,
  initialState,
  isAnalysisStale,
  reducer,
} from "./state";

type ApiClient = typeof apiClient;

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Dashboard shell. All data crosses the browser-safe API client, which
 * validates every response against the shared contracts. A client can be
 * injected for tests; production uses the default same-origin client.
 */
export function Dashboard({ client = apiClient }: { client?: ApiClient }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const analysisAbort = useRef<AbortController | null>(null);
  const focusDetail = useRef(false);

  // Catalog
  useEffect(() => {
    const ac = new AbortController();
    client
      .listProperties(ac.signal)
      .then((res) => {
        if (res.ok) dispatch({ type: "catalog_loaded", properties: res.data.properties });
        else dispatch({ type: "catalog_failed", error: res.error });
      })
      .catch((e) => {
        if (!isAbort(e)) throw e;
      });
    return () => ac.abort();
  }, [client, state.catalogAttempt]);

  // Selected property + spatial context load independently so one failure
  // never hides the other.
  const selectedId = state.selectedId;
  useEffect(() => {
    if (!selectedId) return;
    const ac = new AbortController();
    client
      .getProperty(selectedId, ac.signal)
      .then((res) =>
        res.ok
          ? dispatch({ type: "property_loaded", propertyId: selectedId, property: res.data })
          : dispatch({ type: "property_failed", propertyId: selectedId, error: res.error }),
      )
      .catch((e) => {
        if (!isAbort(e)) throw e;
      });
    client
      .getSpatialContext(selectedId, ac.signal)
      .then((res) =>
        res.ok
          ? dispatch({ type: "spatial_loaded", propertyId: selectedId, spatial: res.data })
          : dispatch({ type: "spatial_failed", propertyId: selectedId, error: res.error }),
      )
      .catch((e) => {
        if (!isAbort(e)) throw e;
      });
    return () => ac.abort();
  }, [client, selectedId, state.propertyAttempt]);

  // Property switch aborts any in-flight analysis.
  useEffect(() => {
    return () => analysisAbort.current?.abort();
  }, [selectedId]);

  // Move focus to the detail heading after a selection so keyboard and
  // screen-reader users land on the new content.
  useEffect(() => {
    if (state.property.status === "ready" && focusDetail.current) {
      focusDetail.current = false;
      document.getElementById("property-heading")?.focus();
    }
  }, [state.property.status]);

  const select = useCallback((id: string) => {
    focusDetail.current = true;
    dispatch({ type: "select", propertyId: id });
  }, []);

  const runAnalysis = useCallback(async () => {
    if (state.property.status !== "ready") return;
    const property = state.property.data;
    const revision = state.inputRevision;
    analysisAbort.current?.abort();
    const ac = new AbortController();
    analysisAbort.current = ac;
    dispatch({ type: "analysis_started" });
    try {
      const res = await client.analyze(
        analysisRequest(property, revision, new Date().getFullYear()),
        ac.signal,
      );
      if (res.ok)
        dispatch({
          type: "analysis_finished",
          propertyId: property.id,
          inputRevision: revision,
          response: res.data,
        });
      else
        dispatch({
          type: "analysis_failed",
          propertyId: property.id,
          inputRevision: revision,
          error: res.error,
        });
    } catch (e) {
      if (isAbort(e)) return;
      // A locally invalid request never leaves the browser; surface it
      // instead of leaving the panel loading forever.
      dispatch({
        type: "analysis_failed",
        propertyId: property.id,
        inputRevision: revision,
        error: {
          code: "INVALID_INPUT",
          message: "The analysis request could not be built from the current inputs.",
          retryable: false,
          requestId: "client-validation",
        },
      });
    }
  }, [client, state.property, state.inputRevision]);

  const cancelAnalysis = useCallback(() => {
    analysisAbort.current?.abort();
    dispatch({ type: "analysis_cancelled" });
  }, []);

  const stale = isAnalysisStale(state);
  const synthetic = hasSyntheticData(state);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kestrel</h1>
            <p className="text-sm text-slate-600">See the potential in every property.</p>
          </div>
          <p className="text-xs text-slate-600">
            Preliminary screening — not an appraisal, zoning determination or
            structural inspection.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {synthetic ? <SyntheticBanner /> : null}

        <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
          <nav aria-labelledby="properties-heading" className="min-w-0">
            <h2 id="properties-heading" className="mb-2 text-sm font-semibold text-slate-900">
              Properties
            </h2>
            {state.catalog.status === "loading" ? (
              <LoadingPanel label="Loading properties…" rows={3} />
            ) : null}
            {state.catalog.status === "error" ? (
              <ErrorPanel
                what="Property catalog"
                error={state.catalog.error}
                onRetry={() => dispatch({ type: "catalog_retry" })}
              />
            ) : null}
            {state.catalog.status === "ready" ? (
              <PropertyList
                properties={state.catalog.data}
                selectedId={state.selectedId}
                onSelect={select}
              />
            ) : null}
          </nav>

          <div className="min-w-0 space-y-6" aria-live="polite">
            {!state.selectedId ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-700">
                Select a property to see its facts, spatial evidence and
                analysis.
              </div>
            ) : null}

            {state.selectedId && state.property.status === "loading" ? (
              <LoadingPanel label="Loading property details…" rows={5} />
            ) : null}
            {state.property.status === "error" ? (
              <ErrorPanel
                what="Property details"
                error={state.property.error}
                onRetry={() => dispatch({ type: "property_retry" })}
              />
            ) : null}
            {state.property.status === "ready" ? (
              <PropertyPanel property={state.property.data} />
            ) : null}

            {state.selectedId && state.spatial.status === "loading" ? (
              <LoadingPanel label="Loading spatial evidence…" rows={3} />
            ) : null}
            {state.spatial.status === "error" ? (
              <ErrorPanel
                what="Spatial evidence"
                error={state.spatial.error}
                onRetry={() => dispatch({ type: "property_retry" })}
              />
            ) : null}
            {state.spatial.status === "ready" ? (
              <SpatialPanel spatial={state.spatial.data} />
            ) : null}

            {state.property.status === "ready" ? (
              <section
                aria-labelledby="analysis-heading"
                className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="analysis-heading" className="text-lg font-semibold">
                    Analysis
                  </h2>
                  <div className="flex items-center gap-2">
                    {state.analysis.status === "ready" ? (
                      <DataModeBadge
                        mode={
                          state.analysis.data.status === "complete"
                            ? state.analysis.data.execution.dataMode
                            : state.analysis.data.property.dataMode
                        }
                        prefix="Result"
                      />
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="bg-slate-900 text-white hover:bg-slate-700"
                      disabled={state.analysis.status === "loading"}
                      onClick={runAnalysis}
                    >
                      <Play aria-hidden />
                      {state.analysis.status === "ready" ? "Run again" : "Run analysis"}
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Sends the baseline draft (known property facts only; unknown
                  values stay unknown) for server-side calculation. The
                  scenario editor arrives in a later task.
                </p>
                <div className="mt-4">
                  {state.analysis.status === "idle" ? (
                    <p className="text-sm text-slate-700">No analysis has been run yet.</p>
                  ) : null}
                  {state.analysis.status === "loading" ? (
                    <LoadingPanel
                      label="Running analysis…"
                      rows={4}
                      onCancel={cancelAnalysis}
                    />
                  ) : null}
                  {state.analysis.status === "error" ? (
                    <ErrorPanel
                      what="Analysis"
                      error={state.analysis.error}
                      onRetry={runAnalysis}
                    />
                  ) : null}
                  {state.analysis.status === "ready" ? (
                    <AnalysisResult response={state.analysis.data} stale={stale} />
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
