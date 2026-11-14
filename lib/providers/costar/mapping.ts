import "server-only";
import { createReadStream } from "node:fs";
import { resolve, extname } from "node:path";
import { parse } from "csv-parse";
import { z } from "zod";
import { Id } from "@/lib/contracts";
import { ProviderError } from "../errors";
const MappingRow = z.object({
  PropertyId: z.string().regex(/^[1-9]\d{0,9}$/),
  MatterportModelId: z.union([Id, z.literal("")]),
});
export interface CommercialModelMatch {
  propertyId: string;
  modelId: string;
  source: "commercial_property_mapping";
}
export async function readCommercialModelMapping(
  config: { kitDir: string; indexPath?: string; agreementAccepted: boolean },
  signal: AbortSignal,
): Promise<CommercialModelMatch[]> {
  if (!config.agreementAccepted)
    throw new ProviderError(
      "LICENSE_RESTRICTED",
      "Sponsor agreement acceptance is required for mapping access.",
    );
  signal.throwIfAborted();
  // A configured index must implement the inspected commercial PropertyId/MatterportModelId contract.
  // Never guess which column in an unrelated residential or geographic index is a commercial ID.
  const path =
    config.indexPath || resolve(config.kitDir, "commercial-properties.csv");
  if (extname(path).toLowerCase() !== ".csv")
    throw new ProviderError(
      "DATA_MISMATCH",
      "The configured model index must be the documented commercial mapping CSV, not a documentation page.",
    );
  const stream = createReadStream(path, { signal });
  const parser = parse({
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 65536,
  });
  stream.on("error", (error) => parser.destroy(error));
  stream.pipe(parser);
  const pairs = new Map<string, CommercialModelMatch>();
  let rows = 0;
  try {
    for await (const raw of parser) {
      signal.throwIfAborted();
      if (++rows > 100000)
        throw new ProviderError(
          "DATA_MISMATCH",
          "The mapping exceeds the approved record limit.",
        );
      const parsed = MappingRow.safeParse(raw);
      if (!parsed.success)
        throw new ProviderError(
          "DATA_MISMATCH",
          "The index lacks a valid explicit commercial property/model mapping.",
        );
      const { PropertyId: propertyId, MatterportModelId: modelId } =
        parsed.data;
      if (!modelId) continue;
      pairs.set(`${propertyId}:${modelId}`, {
        propertyId,
        modelId,
        source: "commercial_property_mapping",
      });
    }
    return [...pairs.values()];
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "UPSTREAM_UNAVAILABLE",
      "The configured commercial model mapping is unavailable or unreadable.",
    );
  } finally {
    stream.destroy();
    parser.destroy();
  }
}
export function selectCommercialModel(
  matches: CommercialModelMatch[],
  propertyId: string,
  reviewedModelId?: string,
): CommercialModelMatch {
  const candidates = matches.filter(
    (m) =>
      m.propertyId === propertyId &&
      (!reviewedModelId || m.modelId === reviewedModelId),
  );
  if (candidates.length !== 1)
    throw new ProviderError(
      "DATA_MISMATCH",
      candidates.length
        ? "Multiple scans require a reviewed model selection."
        : "No explicit commercial property/model match is available.",
    );
  if (
    matches.some(
      (m) => m.modelId === candidates[0].modelId && m.propertyId !== propertyId,
    )
  )
    throw new ProviderError(
      "DATA_MISMATCH",
      "The selected model is assigned to conflicting commercial properties.",
    );
  return candidates[0];
}
