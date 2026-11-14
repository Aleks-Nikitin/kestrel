export * from "../schemas/primitives";
export * from "../schemas/property";
export * from "../schemas/scenarios";
export * from "../schemas/results";
import type { z } from "zod";
import type * as S from "../schemas/scenarios";
import type * as P from "../schemas/property";
import type * as R from "../schemas/results";
export type PropertyDTO = z.infer<typeof P.Property>;
export type SpatialContextDTO = z.infer<typeof P.SpatialContext>;
export type ScenarioDTO = z.infer<typeof S.Scenario>;
export type ScenarioInputDTO = z.infer<typeof S.ScenarioInput>;
export type ConstraintsDTO = z.infer<typeof S.Constraints>;
export type ConstraintsInputDTO = z.infer<typeof S.ConstraintsInput>;
export type ComparisonRequestDTO = z.infer<typeof S.ComparisonRequest>;
export type ComparisonResponseDTO = z.infer<typeof R.ComparisonResponse>;
export type AnalysisRequestDTO = z.infer<typeof S.AnalysisRequest>;
export type AnalysisResponseDTO = z.infer<typeof R.AnalysisResponse>;
export type FinancialResultDTO = z.infer<typeof R.FinancialResult>;
export type ApiErrorDTO = z.infer<typeof R.ApiError>;
export type ApiResponseDTO<T> =
  { ok: true; data: T; requestId: string } | { ok: false; error: ApiErrorDTO };
export interface PropertyProvider {
  listProperties(input: {
    limit: number;
    signal: AbortSignal;
  }): Promise<PropertyDTO[]>;
  getProperty(input: {
    propertyId: string;
    signal: AbortSignal;
  }): Promise<PropertyDTO>;
}
export interface SpatialProvider {
  getSpatialContext(input: {
    property: PropertyDTO;
    signal: AbortSignal;
  }): Promise<SpatialContextDTO>;
}
