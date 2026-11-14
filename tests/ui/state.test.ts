import { describe, expect, it } from "vitest";
import {
  isCompareStale,
  initialState,
  reducer,
  isAnalysisStale,
  hasSyntheticData,
  type DashboardState,
} from "@/features/dashboard/state";
import { ApiError } from "@/lib/contracts";
import { analysis, comparison, property, spatial, propertyId, errors } from "../fixtures/contracts";

const timeout = ApiError.parse(errors.TIMEOUT.error);

function selected(): DashboardState {
  return reducer(initialState, { type: "select", propertyId });
}

describe("dashboard state", () => {
  it("starts with a loading catalog and no selection", () => {
    expect(initialState.catalog.status).toBe("loading");
    expect(initialState.selectedId).toBeNull();
  });

  it("selecting a property resets scenarios, results and revision", () => {
    let s = selected();
    s = reducer(s, { type: "revision_bumped" });
    s = reducer(s, {
      type: "analysis_finished",
      propertyId,
      inputRevision: 2,
      response: analysis,
    });
    expect(s.analysis.status).toBe("ready");
    s = reducer(s, { type: "select", propertyId: "another-property" });
    expect(s.inputRevision).toBe(1);
    expect(s.analysis.status).toBe("idle");
    expect(s.analysisRevision).toBeNull();
    expect(s.property.status).toBe("loading");
    expect(s.spatial.status).toBe("loading");
  });

  it("re-selecting the same property does not reset loaded data", () => {
    const s = reducer(selected(), { type: "property_loaded", propertyId, property });
    expect(reducer(s, { type: "select", propertyId })).toBe(s);
  });

  it("ignores property and spatial results for a property no longer selected", () => {
    const s = reducer(selected(), { type: "select", propertyId: "other" });
    expect(reducer(s, { type: "property_loaded", propertyId, property })).toBe(s);
    expect(reducer(s, { type: "spatial_loaded", propertyId, spatial })).toBe(s);
    expect(reducer(s, { type: "property_failed", propertyId, error: timeout })).toBe(s);
  });

  it("discards a late analysis response for an older input revision", () => {
    let s = reducer(selected(), { type: "analysis_started", action: "analyze" });
    s = reducer(s, { type: "revision_bumped" });
    // The in-flight request answers an older revision, so it stops loading...
    expect(s.analysis.status).toBe("idle");
    // ...and its late response is ignored.
    const after = reducer(s, {
      type: "analysis_finished",
      propertyId,
      inputRevision: 1,
      response: analysis,
    });
    expect(after).toBe(s);
  });

  it("discards a late comparison response and never shows it as current", () => {
    let s = reducer(selected(), { type: "compare_started" });
    s = reducer(s, { type: "revision_bumped" });
    expect(s.compare.status).toBe("idle");
    const late = reducer(s, {
      type: "compare_finished",
      propertyId,
      inputRevision: 1,
      response: comparison,
    });
    expect(late).toBe(s);
    expect(reducer(s, { type: "compare_failed", propertyId, inputRevision: 1, error: timeout })).toBe(s);
  });

  it("accepts a comparison for the current revision and marks it stale after an edit", () => {
    let s = reducer(selected(), { type: "revision_bumped" });
    s = reducer(s, { type: "compare_started" });
    s = reducer(s, { type: "compare_finished", propertyId, inputRevision: 2, response: comparison });
    expect(s.compare.status).toBe("ready");
    expect(isCompareStale(s)).toBe(false);
    s = reducer(s, { type: "revision_bumped" });
    expect(isCompareStale(s)).toBe(true);
    s = reducer(s, { type: "select", propertyId: "other" });
    expect(s.compare.status).toBe("idle");
  });

  it("marks a displayed analysis stale as soon as inputs change", () => {
    let s = reducer(selected(), {
      type: "analysis_finished",
      propertyId,
      inputRevision: 1,
      response: analysis,
    });
    expect(isAnalysisStale(s)).toBe(false);
    s = reducer(s, { type: "revision_bumped" });
    expect(isAnalysisStale(s)).toBe(true);
  });

  it("keeps an analysis failure retryable without touching property data", () => {
    let s = reducer(selected(), { type: "property_loaded", propertyId, property });
    s = reducer(s, { type: "analysis_started", action: "analyze" });
    s = reducer(s, { type: "analysis_failed", propertyId, inputRevision: 1, error: timeout });
    expect(s.analysis).toEqual({ status: "error", error: timeout });
    expect(s.property.status).toBe("ready");
  });

  it("cancel returns the analysis to idle", () => {
    const s = reducer(reducer(selected(), { type: "analysis_started", action: "analyze" }), {
      type: "analysis_cancelled",
    });
    expect(s.analysis.status).toBe("idle");
  });

  it("retry actions bump attempts so effects refetch", () => {
    const failed = reducer(initialState, { type: "catalog_failed", error: timeout });
    const retried = reducer(failed, { type: "catalog_retry" });
    expect(retried.catalog.status).toBe("loading");
    expect(retried.catalogAttempt).toBe(failed.catalogAttempt + 1);
    const p = reducer(selected(), { type: "property_failed", propertyId, error: timeout });
    const pr = reducer(p, { type: "property_retry" });
    expect(pr.propertyAttempt).toBe(p.propertyAttempt + 1);
    expect(pr.spatial.status).toBe("loading");
  });

  it("reports synthetic data from loaded layers", () => {
    expect(hasSyntheticData(initialState)).toBe(false);
    const s = reducer(selected(), { type: "property_loaded", propertyId, property });
    expect(hasSyntheticData(s)).toBe(true);
  });
});
