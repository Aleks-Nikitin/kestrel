"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Box, Calculator, ShieldCheck } from "lucide-react";
import { KestrelMark } from "@/components/kestrel/kestrel-mark";
import { Reveal } from "@/components/kestrel/motion";
import { apiClient } from "@/lib/contracts/client";
import { ErrorPanel, LoadingPanel } from "@/components/kestrel/state-panels";
import { SyntheticBanner } from "@/components/kestrel/synthetic-banner";
import { PropertyList } from "@/features/property/property-list";
import { PropertyHero, PropertyPanel } from "@/features/property/property-panel";
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

  const navigable = state.selectedId && state.property.status === "ready";
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-espresso-700 bg-espresso-950 text-ivory">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <KestrelMark tone="light" className="size-9 shrink-0" />
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold uppercase tracking-[0.3em]">Kestrel</h1>
              <p className="hidden text-xs text-ivory/65 sm:block">Commercial property intelligence</p>
            </div>
          </div>
          {navigable ? (
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
        </div>
      </header>
      <p className="border-b border-slate-200 bg-slate-100 px-4 py-1.5 text-center text-xs text-slate-600">
        Preliminary screening — not an appraisal, zoning determination or
        structural inspection.
      </p>

      <main className="mx-auto max-w-[90rem] space-y-4 px-4 py-5 sm:px-6 sm:py-8">
        {synthetic ? <SyntheticBanner /> : null}

        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-labelledby="properties-heading" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <h2
              id="properties-heading"
              className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
            >
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

          <div className="min-w-0 space-y-8" aria-live="polite">
            {!state.selectedId ? <Welcome /> : null}

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
              <div id="section-property" className="scroll-mt-28 lg:scroll-mt-20">
                <PropertyHero property={state.property.data} />
              </div>
            ) : null}

            <div id="section-spatial" className="scroll-mt-28 space-y-6 lg:scroll-mt-20">
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
                <Reveal>
                  <SpatialPanel
                    spatial={state.spatial.data}
                    location={
                      state.property.status === "ready"
                        ? state.property.data.location.value
                        : null
                    }
                  />
                </Reveal>
              ) : null}
            </div>

            {state.property.status === "ready" ? (
              <Reveal>
                <PropertyPanel property={state.property.data} />
              </Reveal>
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

function Welcome() {
  const points = [
    { icon: Box, text: "Matterport spatial evidence and an explorable 3D tour" },
    { icon: Calculator, text: "A deterministic, server-calculated income comparison" },
    { icon: ShieldCheck, text: "An evidence-bound agent summary with a checking receipt" },
  ];
  return (
    <section
      aria-labelledby="welcome-heading"
      className="overflow-hidden rounded-2xl bg-espresso-900 p-6 text-ivory sm:p-10"
    >
      <KestrelMark tone="light" className="size-14" />
      <h2 id="welcome-heading" className="mt-5 font-display text-3xl leading-tight sm:text-4xl">
        See the potential in every property.
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ivory/75">
        Kestrel screens commercial buildings for reuse, from the facts on record to the room-level
        spatial evidence behind them.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 rounded-lg border border-espresso-600 bg-espresso-800 p-3 text-sm">
            <Icon className="mt-0.5 size-5 shrink-0 text-copper-300" aria-hidden />
            <span className="text-ivory/85">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm font-medium text-copper-200">
        Select a property to see its facts, spatial evidence and analysis.
      </p>
    </section>
  );
}
