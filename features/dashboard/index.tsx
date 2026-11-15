"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { KestrelMark } from "@/components/kestrel/kestrel-mark";
import { SiteFooter } from "@/components/kestrel/site-footer";
import { OverviewLink } from "@/components/kestrel/overview-link";
import { apiClient } from "@/lib/contracts/client";
import { ErrorPanel, LoadingPanel } from "@/components/kestrel/state-panels";
import { SyntheticBanner } from "@/components/kestrel/synthetic-banner";
import { PropertyList } from "@/features/property/property-list";
import { PropertyHero, PropertyPanel } from "@/features/property/property-panel";
import { SpatialPanel } from "@/features/property/spatial-panel";
import { Explorer } from "@/features/map/explorer";
import { resolveTour } from "@/features/map/tour";
import { AnalysisPanel } from "@/features/analysis/analysis-panel";
import { ComparisonStage } from "@/features/scenarios/comparison-stage";
import { UnderwritingStage } from "@/features/scenarios/underwriting-stage";
import { useScenarioEditor } from "@/features/scenarios/use-editor";
import type { AnalysisRequestDTO, ComparisonRequestDTO } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { StageNav, type StageStatus } from "./stage-nav";
import { STAGES, useStage, type StageId } from "./stages";
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
 * Workspace shell. All data crosses the browser-safe API client, which
 * validates every response against the shared contracts. A client can be
 * injected for tests; production uses the default same-origin client.
 */
export function Dashboard({ client = apiClient }: { client?: ApiClient }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const analysisAbort = useRef<AbortController | null>(null);
  const compareAbort = useRef<AbortController | null>(null);
  const focusDetail = useRef(false);
  // Scenario periods start in the year the property was chosen; the clock is
  // read in that event handler only, so rendering stays deterministic.
  const [periodYear, setPeriodYear] = useState<number | null>(null);
  // The request behind the latest submission, kept so the comparison can state
  // the limits it was tested against. Display only; the server decides.
  const [submitted, setSubmitted] = useState<ComparisonRequestDTO | null>(null);

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

  const property = state.property.status === "ready" ? state.property.data : null;
  const { stage, go } = useStage(property !== null);

  // Move focus to the new property's heading after a selection so keyboard and
  // screen-reader users land on the new content.
  useEffect(() => {
    if (state.property.status === "ready" && focusDetail.current) {
      focusDetail.current = false;
      document.getElementById(stage === "building" ? "building-heading" : "property-heading")?.focus();
    }
  }, [state.property.status, stage]);

  const select = useCallback((id: string) => {
    focusDetail.current = true;
    setPeriodYear(new Date().getFullYear());
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

  const editor = useScenarioEditor(property, state.selectedId, periodYear, state.inputRevision, onEdited);

  // Submitting is the step from underwriting to comparison: valid drafts are
  // sent and the result stage opens; invalid drafts stay put and are marked.
  function calculate() {
    if (!editor) return;
    if (!editor.request) {
      editor.markAttempt();
      go("underwriting");
      return;
    }
    editor.clearAttempt();
    setSubmitted(editor.request);
    void runCompare(editor.request);
    go("comparison");
  }

  // A footprint is only drawn for a verified match to the selected property.
  const verifiedFootprint =
    state.spatial.status === "ready" &&
    state.spatial.data.propertyId === state.selectedId &&
    state.spatial.data.match.status === "verified"
      ? (state.spatial.data.imagery?.footprintGeoJSON ?? null)
      : null;
  const analysisStale = isAnalysisStale(state);
  const compareStale = isCompareStale(state);
  const synthetic = hasSyntheticData(state);
  const tour = resolveTour(state.spatial, state.selectedId);
  const address = property?.address.value ?? "Selected property";

  const available = new Set<StageId>(property ? STAGES.map((s) => s.id) : ["overview"]);
  const status: Partial<Record<StageId, StageStatus>> = {};
  if (property && editor) {
    status.overview = { text: "Selected", tone: "quiet", done: true };
    status.building =
      tour.status === "available"
        ? { text: "3D tour ready", tone: "good" }
        : tour.status === "checking"
          ? { text: "Checking tour", tone: "quiet" }
          : { text: "No 3D tour", tone: "quiet" };
    status.underwriting =
      editor.totalProblems > 0
        ? { text: `${editor.totalProblems} to fix`, tone: "attention" }
        : editor.ready.total > 0
          ? { text: `${editor.ready.total} inputs open`, tone: "quiet" }
          : { text: "Inputs complete", tone: "good", done: true };
    status.comparison =
      state.compare.status === "loading"
        ? { text: "Calculating", tone: "quiet" }
        : state.compare.status === "error"
          ? { text: "Failed", tone: "attention" }
          : state.compare.status === "ready"
            ? compareStale
              ? { text: "Out of date", tone: "attention" }
              : { text: "Current", tone: "good", done: true }
            : { text: "Not run", tone: "quiet" };
    status.investigation =
      state.analysis.status === "loading"
        ? { text: "Running", tone: "quiet" }
        : state.analysis.status === "error"
          ? { text: "Unavailable", tone: "attention" }
          : state.analysis.status === "ready"
            ? analysisStale
              ? { text: "Out of date", tone: "attention" }
              : state.analysis.data.status === "needs_input"
                ? { text: "Needs input", tone: "attention" }
                : state.analysis.data.execution.verification
                  ? { text: "Verified", tone: "good", done: true }
                  : { text: "Complete", tone: "good", done: true }
            : { text: "Not run", tone: "quiet" };
  }

  const onSite = stage === "overview" || stage === "building";
  const overview = stage === "overview";
  return (
    <div className="flex min-h-screen flex-col bg-ink-50 text-ink-900">
      <header className="sticky top-0 z-40 bg-ink-950 text-white">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center gap-x-8 px-4 sm:px-6">
          <OverviewLink className="flex items-center gap-2.5 rounded-md py-2 focus-visible:outline-buff-200">
            <KestrelMark tone="light" className="size-8 shrink-0" />
            <h1 className="text-[15px] font-bold tracking-[0.2em] [font-stretch:112%]">KESTREL</h1>
          </OverviewLink>
          <div className="order-last -mx-4 min-w-0 basis-full border-t border-white/10 px-1 sm:-mx-6 sm:px-3 lg:order-none lg:mx-0 lg:basis-auto lg:flex-1 lg:border-t-0 lg:px-0">
            <StageNav stage={stage} available={available} status={status} />
          </div>
          {property ? (
            <p className="ml-auto hidden min-w-0 max-w-[22rem] text-right text-xs leading-tight text-ink-300 md:block">
              <span className="block truncate text-[13px] font-semibold text-white">{address}</span>
              {overview ? "Selected property" : <a href="#overview" className="underline underline-offset-2 hover:text-white focus-visible:outline-buff-200">Change property</a>}
            </p>
          ) : null}
        </div>
      </header>
      {synthetic ? <SyntheticBanner /> : null}

      <main id="overview" tabIndex={-1} className="mx-auto w-full max-w-[96rem] flex-1 px-4 pb-16 pt-6 outline-none sm:px-6 sm:pt-8">
        {/* Overview and Building share one map instance, so both are framings of the same block. */}
        <div
          hidden={!onSite}
          className={cn("grid gap-5", overview && "lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1.1fr)_minmax(0,1fr)]")}
        >
          <nav hidden={!overview} aria-labelledby="properties-heading" className="min-w-0 lg:row-span-3 lg:self-start">
            <h2 id="properties-heading" className="mb-2 flex items-baseline justify-between text-sm font-semibold text-ink-900">
              Properties
              {state.catalog.status === "ready" ? (
                <span className="figure text-xs font-medium text-ink-500">{state.catalog.data.length}</span>
              ) : null}
            </h2>
            {state.catalog.status === "loading" ? <LoadingPanel label="Loading properties…" rows={3} /> : null}
            {state.catalog.status === "error" ? (
              <ErrorPanel
                what="Property catalog"
                error={state.catalog.error}
                onRetry={() => dispatch({ type: "catalog_retry" })}
              />
            ) : null}
            {state.catalog.status === "ready" ? (
              <PropertyList properties={state.catalog.data} selectedId={state.selectedId} onSelect={select} />
            ) : null}
          </nav>

          <div hidden={!overview} className="min-w-0 xl:col-span-2" aria-live="polite">
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
            {property ? <PropertyHero property={property} /> : null}
          </div>

          {stage === "building" ? (
            <header className="stage-in flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="text-sm text-ink-500">{address}</p>
                <h2 id="building-heading" tabIndex={-1} className="type-display mt-1 text-4xl text-ink-950 outline-none sm:text-5xl">
                  Building
                </h2>
              </div>
              <a href="#underwriting" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-semibold text-buff-100 hover:bg-ink-800">
                Start underwriting <ArrowRight className="size-4" aria-hidden />
              </a>
            </header>
          ) : null}

          <div className={cn("min-w-0", overview && (property ? "lg:col-start-2" : "lg:col-start-2 xl:col-span-2"))}>
            {state.catalog.status === "ready" ? (
              <Explorer
                compact={overview}
                prefer3d={stage === "building"}
                tour={tour}
                tourTitle={property ? `3D tour of ${property.address.value ?? "selected property"}` : "3D tour"}
                properties={state.catalog.data}
                selectedId={state.selectedId}
                onSelect={select}
                footprint={verifiedFootprint}
              />
            ) : null}
          </div>

          {property ? (
            <div hidden={!overview} className="min-w-0 lg:col-start-2 xl:col-start-3">
              <PropertyPanel property={property} />
            </div>
          ) : null}

          <div hidden={stage !== "building"} className="min-w-0 space-y-5">
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
              <SpatialPanel spatial={state.spatial.data} location={property ? property.location.value : null} />
            ) : null}
          </div>
        </div>

        {property && editor ? (
          <>
            <UnderwritingStage
              hidden={stage !== "underwriting"}
              editor={editor}
              inputRevision={state.inputRevision}
              hasResult={state.compare.status === "ready"}
              calculating={state.compare.status === "loading"}
              onCalculate={calculate}
            />
            <ComparisonStage
              hidden={stage !== "comparison"}
              address={address}
              compare={state.compare}
              submitted={submitted}
              stale={compareStale}
              problems={editor.totalProblems}
              openInputs={editor.ready.total}
              onCalculate={calculate}
              onCancel={cancelCompare}
            />
            <AnalysisPanel
              hidden={stage !== "investigation"}
              address={address}
              request={editor.request}
              problems={editor.totalProblems}
              analysis={state.analysis}
              action={state.analysisAction}
              stale={analysisStale}
              onRun={runAnalysis}
              onCancel={cancelAnalysis}
            />
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

/** The first screen: what Kestrel is for, and the one thing to do next. */
function Welcome() {
  const steps = [
    ["Explore", "Read the record and walk the building's 3D scan."],
    ["Underwrite", "Set a baseline and alternative uses, with every assumption labeled."],
    ["Compare", "Get a deterministic income comparison from the server."],
    ["Investigate", "Have the analyst explain it, citing the evidence it used."],
  ] as const;
  return (
    <section aria-labelledby="welcome-heading" className="survey-grid overflow-hidden rounded-xl bg-ink-900 p-6 text-white sm:p-9">
      <h2 id="welcome-heading" className="type-display max-w-3xl text-[2.6rem] text-buff-100 sm:text-6xl">
        See what a building could become, and what the evidence supports.
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-200">
        Kestrel screens commercial properties for reuse: the facts on record, a walkable scan of the space,
        and investment scenarios you can defend line by line.
      </p>
      <ol className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map(([title, text], i) => (
          <li key={title} className="border-t border-white/20 pt-3">
            <p className="flex items-baseline gap-2 text-sm font-semibold text-white">
              <span className="figure text-rufous-300" aria-hidden>{i + 1}</span>
              {title}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-ink-300">{text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-7 text-sm font-medium text-buff-200">Choose a property from the index or the map to begin.</p>
    </section>
  );
}
