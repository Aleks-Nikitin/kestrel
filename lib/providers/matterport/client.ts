import "server-only";
import { z } from "zod";
import { Id } from "@/lib/contracts";
import { ProviderError } from "../errors";
const Coordinate = z
  .union([z.number(), z.string().regex(/^-?\d{1,3}(?:\.\d{1,15})?$/)])
  .transform(Number)
  .pipe(z.number().finite());
const Dimension = z.number().finite().nonnegative().nullable().optional();
export const MatterportModel = z.object({
  id: Id,
  geolocation: z
    .object({
      lat: Coordinate.pipe(z.number().min(-90).max(90)).nullable(),
      long: Coordinate.pipe(z.number().min(-180).max(180)).nullable(),
    })
    .nullable()
    .optional(),
  rooms: z
    .array(
      z.object({
        id: Id,
        dimensions: z
          .object({
            areaFloor: Dimension,
            width: Dimension,
            depth: Dimension,
            height: Dimension,
          })
          .nullable()
          .optional(),
      }),
    )
    .max(500)
    .nullable()
    .optional(),
});
export type MatterportModelDTO = z.infer<typeof MatterportModel>;
const Envelope = z.object({
  data: z.object({ model: MatterportModel.nullable() }).nullable().optional(),
  errors: z
    .array(
      z.object({
        extensions: z.object({ code: z.string().optional() }).optional(),
      }),
    )
    .optional(),
});
export const MODEL_QUERY = `query KestrelRoomDimensions($id: ID!) {
  model(id: $id) {
    id
    geolocation { lat long }
    rooms { id dimensions(units: metric) { areaFloor width depth height } }
  }
}`;
export interface MatterportConfig {
  apiKey?: string;
  apiToken?: string;
  agreementAccepted: boolean;
  transport?: typeof fetch;
  timeoutMs?: number;
}
async function readBoundedJSON(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const maxBytes = 1024 * 1024;
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new ProviderError(
      "DATA_MISMATCH",
      "Matterport response exceeds the approved size limit.",
    );
  }
  if (!response.body)
    throw new ProviderError(
      "DATA_MISMATCH",
      "Matterport returned an empty response.",
    );
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ProviderError(
          "DATA_MISMATCH",
          "Matterport response exceeds the approved size limit.",
        );
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProviderError(
      "DATA_MISMATCH",
      "Matterport returned invalid JSON.",
    );
  }
}
export class MatterportClient {
  constructor(private readonly config: MatterportConfig) {}
  async getModel(
    modelId: string,
    callerSignal: AbortSignal,
  ): Promise<MatterportModelDTO> {
    if (!this.config.agreementAccepted)
      throw new ProviderError(
        "LICENSE_RESTRICTED",
        "Sponsor agreement acceptance is required for Matterport access.",
      );
    if (!this.config.apiKey || !this.config.apiToken)
      throw new ProviderError(
        "UPSTREAM_AUTH",
        "MATTERPORT_API_KEY and MATTERPORT_API_TOKEN are required.",
      );
    if (!Id.safeParse(modelId).success)
      throw new ProviderError(
        "INVALID_INPUT",
        "A valid mapped model identifier is required.",
      );
    callerSignal.throwIfAborted();
    const signal = AbortSignal.any([
      callerSignal,
      AbortSignal.timeout(Math.min(this.config.timeoutMs ?? 12000, 12000)),
    ]);
    try {
      const response = await (this.config.transport ?? fetch)(
        "https://api.matterport.com/api/models/graph",
        {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.apiToken}`).toString("base64")}`,
          },
          body: JSON.stringify({
            query: MODEL_QUERY,
            variables: { id: modelId },
          }),
        },
      );
      if (response.status === 401 || response.status === 403)
        throw new ProviderError(
          "UPSTREAM_AUTH",
          "Matterport credentials or model access were rejected.",
        );
      if (response.status === 429)
        throw new ProviderError(
          "RATE_LIMITED",
          "Matterport rate limit reached.",
          true,
        );
      if (!response.ok)
        throw new ProviderError(
          "UPSTREAM_UNAVAILABLE",
          "Matterport is unavailable.",
          response.status >= 500,
        );
      const parsed = Envelope.safeParse(
        await readBoundedJSON(response, signal),
      );
      if (!parsed.success)
        throw new ProviderError(
          "DATA_MISMATCH",
          "Matterport returned an unsupported model response.",
        );
      if (parsed.data.errors?.length) {
        const auth = parsed.data.errors.some((e) =>
          ["UNAUTHENTICATED", "FORBIDDEN"].includes(e.extensions?.code ?? ""),
        );
        throw new ProviderError(
          auth ? "UPSTREAM_AUTH" : "DATA_MISMATCH",
          "Matterport could not supply the requested model fields.",
        );
      }
      const model = parsed.data.data?.model;
      if (!model)
        throw new ProviderError(
          "NOT_FOUND",
          "The explicitly mapped Matterport model is unavailable.",
        );
      if (model.id !== modelId)
        throw new ProviderError(
          "DATA_MISMATCH",
          "Matterport returned a different model from the explicit mapping.",
        );
      return model;
    } catch (error) {
      if (callerSignal.aborted) throw callerSignal.reason;
      if (signal.aborted)
        throw new ProviderError(
          "TIMEOUT",
          "Matterport exceeded the request deadline.",
          true,
        );
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        "UPSTREAM_UNAVAILABLE",
        "Matterport could not be reached.",
        true,
      );
    }
  }
}
