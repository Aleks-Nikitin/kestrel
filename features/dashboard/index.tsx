"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { apiClient } from "@/lib/contracts/client";
import { ErrorPanel, LoadingPanel } from "@/components/kestrel/state-panels";
import { SyntheticBanner } from "@/components/kestrel/synthetic-banner";
import { PropertyList } from "@/features/property/property-list";
import { PropertyPanel } from "@/features/property/property-panel";
import { SpatialPanel } from "@/features/property/spatial-panel";
import { SectionNav } from "./section-nav";
import { Explorer } from "@/features/map/explorer";
import { resolveTour } from "@/features/map/tour";
import { AnalysisPanel } from "@/features/analysis/analysis-panel";
import { ScenarioWorkspace } from "@/features/scenarios/scenario-workspace";
import type { AnalysisRequestDTO, ComparisonRequestDTO } from "@/lib/contracts";
import {
  hasSyntheticData,
  initialState,
  isAnalysisStale,
  isCompareStale,
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
  const compareAbort = useRef<AbortController | null>(null);
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

  // Property switch aborts any in-flight analysis or comparison.
  useEffect(() => {
    return () => {
      analysisAbort.current?.abort();
      compareAbort.current?.abort();
    };
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

  const runAnalysis = useCallback(
    async (request: AnalysisRequestDTO) => {
      analysisAbort.current?.abort();
      const ac = new AbortController();
      analysisAbort.current = ac;
      dispatch({ type: "analysis_started", action: request.action });
      try {
        const res = await client.analyze(request, ac.signal);
        if (res.ok)
          dispatch({
            type: "analysis_finished",
            propertyId: request.propertyId,
            inputRevision: request.inputRevision,
            response: res.data,
          });
        else
          dispatch({
            type: "analysis_failed",
            propertyId: request.propertyId,
            inputRevision: request.inputRevision,
            error: res.error,
          });
      } catch (e) {
        if (isAbort(e)) return;
        // A locally invalid request never leaves the browser; surface it
        // instead of leaving the panel loading forever.
        dispatch({
          type: "analysis_failed",
          propertyId: request.propertyId,
          inputRevision: request.inputRevision,
          error: {
            code: "INVALID_INPUT",
            message: "The analysis request could not be built from the current inputs.",
            retryable: false,
            requestId: "client-validation",
          },
        });
      }
    },
    [client],
  );

  const runCompare = useCallback(
    async (request: ComparisonRequestDTO) => {
      compareAbort.current?.abort();
      const ac = new AbortController();
      compareAbort.current = ac;
      dispatch({ type: "compare_started" });
      try {
        const res = await client.compare(request, ac.signal);
        if (res.ok)
          dispatch({
            type: "compare_finished",
            propertyId: request.propertyId,
            inputRevision: request.inputRevision,
            response: res.data,
          });
        else
          dispatch({
            type: "compare_failed",
            propertyId: request.propertyId,
            inputRevision: request.inputRevision,
            error: res.error,
          });
      } catch (e) {
        if (isAbort(e)) return;
        dispatch({
          type: "compare_failed",
          propertyId: request.propertyId,
          inputRevision: request.inputRevision,
          error: {
            code: "INVALID_INPUT",
            message: "The comparison request could not be built from the current inputs.",
            retryable: false,
            requestId: "client-validation",
          },
        });
      }
    },
    [client],
  );

  const cancelCompare = useCallback(() => {
    compareAbort.current?.abort();
    dispatch({ type: "compare_cancelled" });
  }, []);

  // Any edit advances the revision and abandons a request still in flight.
  const onEdited = useCallback(() => {
    compareAbort.current?.abort();
    analysisAbort.current?.abort();
    dispatch({ type: "revision_bumped" });
  }, []);

  const cancelAnalysis = useCallback(() => {
    analysisAbort.current?.abort();
    dispatch({ type: "analysis_cancelled" });
  }, []);

  // A footprint is only drawn for a verified match to the selected property.
  const verifiedFootprint =
    state.spatial.status === "ready" &&
    state.spatial.data.propertyId === state.selectedId &&
    state.spatial.data.match.status === "verified"
      ? (state.spatial.data.imagery?.footprintGeoJSON ?? null)
      : null;
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
        {state.selectedId && state.property.status === "ready" ? (
          <SectionNav
            available={[
              "section-property",
              ...(state.spatial.status === "ready" ? ["section-spatial"] : []),
              "section-scenarios",
              "section-comparison",
              "section-analysis",
            ]}
          />
        ) : null}

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
            {state.catalog.status === "ready" ? (
              <Explorer
                tour={resolveTour(state.spatial, state.selectedId)}
                tourTitle={
                  state.property.status === "ready"
                    ? `3D tour of ${state.property.data.address.value ?? "selected property"}`
                    : "3D tour"
                }
                properties={state.catalog.data}
                selectedId={state.selectedId}
                onSelect={select}
                footprint={verifiedFootprint}
              />
            ) : null}

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
              <div id="section-property" className="scroll-mt-16">
                <PropertyPanel property={state.property.data} />
              </div>
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
              <div id="section-spatial" className="scroll-mt-16">
              <SpatialPanel
                spatial={state.spatial.data}
                location={
                  state.property.status === "ready"
                    ? state.property.data.location.value
                    : null
                }
              />
              </div>
            ) : null}

            {state.property.status === "ready" ? (
              <ScenarioWorkspace
                key={state.property.data.id}
                property={state.property.data}
                inputRevision={state.inputRevision}
                compare={state.compare}
                stale={isCompareStale(state)}
                onEdited={onEdited}
                onCompare={runCompare}
                onCancel={cancelCompare}
              >
                {({ request, problems }) => (
                  <AnalysisPanel
                    request={request}
                    problems={problems}
                    analysis={state.analysis}
                    action={state.analysisAction}
                    stale={stale}
                    onRun={runAnalysis}
                    onCancel={cancelAnalysis}
                  />
                )}
              </ScenarioWorkspace>
            ) : null}

          </div>
        </div>
      </main>
    </div>
  );
}
