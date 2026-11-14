import type { z } from "zod";
import type { CatalogResponse } from "@/lib/contracts";
import type {
  AnalysisResponseDTO,
  ApiErrorDTO,
  ComparisonResponseDTO,
  PropertyDTO,
  SpatialContextDTO,
} from "@/lib/contracts";
import { isCurrentResponse } from "@/lib/contracts/client";

export type PropertySummaryDTO = z.infer<
  typeof CatalogResponse
>["properties"][number];

export type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: ApiErrorDTO };

export interface DashboardState {
  catalog: Load<PropertySummaryDTO[]>;
  catalogAttempt: number;
  selectedId: string | null;
  propertyAttempt: number;
  inputRevision: number;
  property: Load<PropertyDTO>;
  spatial: Load<SpatialContextDTO>;
  analysis: Load<AnalysisResponseDTO>;
  /** Revision the displayed analysis answered; null when none. */
  analysisRevision: number | null;
  compare: Load<ComparisonResponseDTO>;
  /** Revision the displayed comparison answered; null when none. */
  compareRevision: number | null;
}

export const initialState: DashboardState = {
  catalog: { status: "loading" },
  catalogAttempt: 0,
  selectedId: null,
  propertyAttempt: 0,
  inputRevision: 1,
  property: { status: "idle" },
  spatial: { status: "idle" },
  analysis: { status: "idle" },
  analysisRevision: null,
  compare: { status: "idle" },
  compareRevision: null,
};

export type Action =
  | { type: "catalog_loaded"; properties: PropertySummaryDTO[] }
  | { type: "catalog_failed"; error: ApiErrorDTO }
  | { type: "catalog_retry" }
  | { type: "select"; propertyId: string }
  | { type: "property_retry" }
  | { type: "property_loaded"; propertyId: string; property: PropertyDTO }
  | { type: "property_failed"; propertyId: string; error: ApiErrorDTO }
  | { type: "spatial_loaded"; propertyId: string; spatial: SpatialContextDTO }
  | { type: "spatial_failed"; propertyId: string; error: ApiErrorDTO }
  | { type: "revision_bumped" }
  | { type: "compare_started" }
  | { type: "compare_cancelled" }
  | {
      type: "compare_finished";
      propertyId: string;
      inputRevision: number;
      response: ComparisonResponseDTO;
    }
  | {
      type: "compare_failed";
      propertyId: string;
      inputRevision: number;
      error: ApiErrorDTO;
    }
  | { type: "analysis_started" }
  | { type: "analysis_cancelled" }
  | {
      type: "analysis_finished";
      propertyId: string;
      inputRevision: number;
      response: AnalysisResponseDTO;
    }
  | {
      type: "analysis_failed";
      propertyId: string;
      inputRevision: number;
      error: ApiErrorDTO;
    };

function current(state: DashboardState, propertyId: string) {
  return state.selectedId === propertyId;
}

export function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "catalog_loaded":
      return { ...state, catalog: { status: "ready", data: action.properties } };
    case "catalog_failed":
      return { ...state, catalog: { status: "error", error: action.error } };
    case "catalog_retry":
      return {
        ...state,
        catalog: { status: "loading" },
        catalogAttempt: state.catalogAttempt + 1,
      };
    case "select":
      if (state.selectedId === action.propertyId) return state;
      // A property switch discards scenarios, results and any in-flight state.
      return {
        ...state,
        selectedId: action.propertyId,
        inputRevision: 1,
        property: { status: "loading" },
        spatial: { status: "loading" },
        analysis: { status: "idle" },
        analysisRevision: null,
        compare: { status: "idle" },
        compareRevision: null,
        propertyAttempt: state.propertyAttempt + 1,
      };
    case "property_retry":
      if (!state.selectedId) return state;
      return {
        ...state,
        property: { status: "loading" },
        spatial: { status: "loading" },
        propertyAttempt: state.propertyAttempt + 1,
      };
    case "property_loaded":
      if (!current(state, action.propertyId)) return state;
      return { ...state, property: { status: "ready", data: action.property } };
    case "property_failed":
      if (!current(state, action.propertyId)) return state;
      return { ...state, property: { status: "error", error: action.error } };
    case "spatial_loaded":
      if (!current(state, action.propertyId)) return state;
      return { ...state, spatial: { status: "ready", data: action.spatial } };
    case "spatial_failed":
      if (!current(state, action.propertyId)) return state;
      return { ...state, spatial: { status: "error", error: action.error } };
    case "revision_bumped":
      // Every input edit advances the revision; older answers become stale.
      // A request still in flight answers an older revision and will be
      // discarded, so stop showing it as loading.
      return {
        ...state,
        inputRevision: state.inputRevision + 1,
        analysis:
          state.analysis.status === "loading" ? { status: "idle" } : state.analysis,
        compare:
          state.compare.status === "loading" ? { status: "idle" } : state.compare,
      };
    case "compare_started":
      return { ...state, compare: { status: "loading" }, compareRevision: null };
    case "compare_cancelled":
      return { ...state, compare: { status: "idle" }, compareRevision: null };
    case "compare_finished":
    case "compare_failed": {
      if (
        !state.selectedId ||
        !isCurrentResponse(
          { propertyId: state.selectedId, inputRevision: state.inputRevision },
          { propertyId: action.propertyId, inputRevision: action.inputRevision },
        )
      )
        return state;
      return action.type === "compare_finished"
        ? {
            ...state,
            compare: { status: "ready", data: action.response },
            compareRevision: action.inputRevision,
          }
        : {
            ...state,
            compare: { status: "error", error: action.error },
            compareRevision: null,
          };
    }
    case "analysis_started":
      return { ...state, analysis: { status: "loading" }, analysisRevision: null };
    case "analysis_cancelled":
      return { ...state, analysis: { status: "idle" }, analysisRevision: null };
    case "analysis_finished": {
      if (
        !state.selectedId ||
        !isCurrentResponse(
          { propertyId: state.selectedId, inputRevision: state.inputRevision },
          { propertyId: action.propertyId, inputRevision: action.inputRevision },
        )
      )
        return state;
      return {
        ...state,
        analysis: { status: "ready", data: action.response },
        analysisRevision: action.inputRevision,
      };
    }
    case "analysis_failed": {
      if (
        !state.selectedId ||
        !isCurrentResponse(
          { propertyId: state.selectedId, inputRevision: state.inputRevision },
          { propertyId: action.propertyId, inputRevision: action.inputRevision },
        )
      )
        return state;
      return {
        ...state,
        analysis: { status: "error", error: action.error },
        analysisRevision: null,
      };
    }
  }
}

export function isAnalysisStale(state: DashboardState): boolean {
  return (
    state.analysis.status === "ready" &&
    state.analysisRevision !== state.inputRevision
  );
}

export function isCompareStale(state: DashboardState): boolean {
  return (
    state.compare.status === "ready" &&
    state.compareRevision !== state.inputRevision
  );
}

/** True if any displayed layer is synthetic (fixture or fictional) data. */
export function hasSyntheticData(state: DashboardState): boolean {
  if (
    state.catalog.status === "ready" &&
    state.catalog.data.some((p) => p.dataMode === "synthetic")
  )
    return true;
  if (state.property.status === "ready" && state.property.data.dataMode === "synthetic")
    return true;
  return (
    state.spatial.status === "ready" && state.spatial.data.dataMode === "synthetic"
  );
}
