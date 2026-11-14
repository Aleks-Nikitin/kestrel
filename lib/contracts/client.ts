import { z } from "zod";
import {
  Id,
  Property,
  SpatialContext,
  CatalogResponse,
  ComparisonRequest,
  ComparisonResponse,
  AnalysisRequest,
  AnalysisResponse,
  apiResponse,
  type ApiResponseDTO,
  type ComparisonRequestDTO,
  type AnalysisRequestDTO,
} from ".";
const mismatch = (): ApiResponseDTO<never> => ({
  ok: false,
  error: {
    code: "CONTRACT_MISMATCH",
    message:
      "The server returned an invalid response. Your edits are preserved.",
    retryable: false,
    requestId: "client-contract",
  },
});
export function isCurrentResponse(
  current: { propertyId: string; inputRevision: number },
  incoming: { propertyId: string; inputRevision: number },
) {
  return (
    current.propertyId === incoming.propertyId &&
    current.inputRevision === incoming.inputRevision
  );
}
export function createApiClient(transport: typeof fetch = fetch) {
  async function request<T extends z.ZodType>(
    path: string,
    schema: T,
    options: RequestInit = {},
    expected?: { propertyId: string; inputRevision?: number },
  ): Promise<ApiResponseDTO<z.infer<T>>> {
    try {
      const response = await transport(`/api/v1${path}`, {
        ...options,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...options.headers },
      });
      const parsed = apiResponse(schema).safeParse(await response.json());
      if (!parsed.success || parsed.data.ok !== response.ok) return mismatch();
      const result = parsed.data as ApiResponseDTO<z.infer<T>>;
      if (result.ok && expected) {
        const data = result.data as {
          propertyId?: string;
          property?: { id: string };
          inputRevision?: number;
        };
        if (
          (data.propertyId ?? data.property?.id) !== expected.propertyId ||
          (expected.inputRevision !== undefined &&
            data.inputRevision !== expected.inputRevision)
        )
          return mismatch();
      }
      return result as ApiResponseDTO<z.infer<T>>;
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw error;
      if (error instanceof SyntaxError) return mismatch();
      return {
        ok: false,
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Unable to reach the server. Your edits are preserved.",
          retryable: true,
          requestId: "client-network",
        },
      };
    }
  }
  return {
    listProperties: (signal?: AbortSignal) =>
      request("/properties", CatalogResponse, { signal }),
    getProperty: (propertyId: string, signal?: AbortSignal) =>
      request(
        `/properties/${encodeURIComponent(Id.parse(propertyId))}`,
        Property,
        { signal },
        { propertyId },
      ),
    getSpatialContext: (propertyId: string, signal?: AbortSignal) =>
      request(
        `/properties/${encodeURIComponent(Id.parse(propertyId))}/spatial`,
        SpatialContext,
        { signal },
        { propertyId },
      ),
    compare: (input: ComparisonRequestDTO, signal?: AbortSignal) =>
      request(
        "/scenarios/compare",
        ComparisonResponse,
        {
          method: "POST",
          body: JSON.stringify(ComparisonRequest.parse(input)),
          signal,
        },
        input,
      ),
    analyze: (input: AnalysisRequestDTO, signal?: AbortSignal) =>
      request(
        "/analysis",
        AnalysisResponse,
        {
          method: "POST",
          body: JSON.stringify(AnalysisRequest.parse(input)),
          signal,
        },
        input,
      ),
  };
}
export const apiClient = createApiClient();
