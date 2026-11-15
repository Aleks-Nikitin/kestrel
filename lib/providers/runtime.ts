import "server-only";
import { extname } from "node:path";
import { z } from "zod";
import {
  Property,
  ShowcasePublication,
  Id,
  type PropertyProvider,
  type SpatialProvider,
} from "@/lib/contracts";
import { CoStarDatasetProvider } from "./costar/dataset";
import {
  readCommercialModelMapping,
  selectCommercialModel,
} from "./costar/mapping";
import { MatterportClient } from "./matterport/client";
import { MatterportSpatialProvider } from "./matterport/spatial";
import { ProviderError } from "./errors";
const ProtectedRecord = z.strictObject({
  property: Property,
  modelMapping: z.strictObject({
    propertyId: Id,
    modelId: Id,
    source: z.literal("commercial_property_mapping"),
    showcase: ShowcasePublication.optional(),
  }),
});
export function createRuntimeProviders(): {
  property: PropertyProvider;
  spatial: SpatialProvider;
} {
  if (process.env.SPONSOR_AGREEMENT_ACCEPTED !== "true")
    throw new ProviderError(
      "LICENSE_RESTRICTED",
      "Sponsor agreement acceptance must be configured for this runtime.",
    );
  const permitted = {
    display: process.env.SPONSOR_DISPLAY_PERMITTED === "true",
    modelProcessing: process.env.SPONSOR_DATA_PROCESSING_PERMITTED === "true",
    export: false,
  };
  if (!permitted.display)
    throw new ProviderError(
      "LICENSE_RESTRICTED",
      "Sponsor display is not enabled for this runtime.",
    );
  // Owner-approved deployment transport: one minimal normalized record, held in
  // protected server environment configuration; never a Git/build data fixture.
  if (process.env.KESTREL_PROTECTED_PROPERTY) {
    let raw: unknown;
    try {
      raw = JSON.parse(process.env.KESTREL_PROTECTED_PROPERTY);
    } catch {
      throw new ProviderError(
        "DATA_MISMATCH",
        "Protected property configuration is invalid.",
      );
    }
    const record = ProtectedRecord.safeParse(raw);
    if (
      !record.success ||
      record.data.property.id !== record.data.modelMapping.propertyId
    )
      throw new ProviderError(
        "DATA_MISMATCH",
        "Protected property configuration failed identity validation.",
      );
    const property = record.data.property;
    property.dataMode = "licensed_cache";
    property.evidence = property.evidence.map((e) => ({
      ...e,
      allowedUse: permitted,
    }));
    const binding = record.data.modelMapping;
    const propertyProvider: PropertyProvider = {
      async listProperties({ signal }) {
        signal.throwIfAborted();
        return [property];
      },
      async getProperty({ propertyId, signal }) {
        signal.throwIfAborted();
        if (propertyId !== property.id)
          throw new ProviderError(
            "NOT_FOUND",
            "Property not in the permitted demo catalog.",
          );
        return property;
      },
    };
    const spatialProvider = new MatterportSpatialProvider(
      new MatterportClient({
        apiKey: process.env.MATTERPORT_API_KEY,
        apiToken: process.env.MATTERPORT_API_TOKEN,
        agreementAccepted: true,
      }),
      async () => [binding],
      { permissions: permitted, showcase: binding.showcase },
    );
    return { property: propertyProvider, spatial: spatialProvider };
  }
  const kitDir = process.env.COSTAR_KIT_DIR;
  if (!kitDir)
    throw new ProviderError(
      "UPSTREAM_UNAVAILABLE",
      "COSTAR_KIT_DIR or protected property configuration is required.",
    );
  const config = {
    kitDir,
    agreementAccepted: true,
    permissions: permitted,
    indexPath: process.env.COSTAR_MODELS_INDEX_PATH || undefined,
  };
  if (config.indexPath && extname(config.indexPath).toLowerCase() !== ".csv")
    throw new ProviderError(
      "DATA_MISMATCH",
      "COSTAR_MODELS_INDEX_PATH must point to the commercial mapping CSV.",
    );
  const dataset = new CoStarDatasetProvider(config);
  let selection: ReturnType<typeof select> | undefined;
  async function select(signal: AbortSignal) {
    const mapping = await readCommercialModelMapping(config, signal);
    const catalog = process.env.COSTAR_DEMO_PROPERTY_ID
      ? [
          await dataset.getProperty({
            propertyId: process.env.COSTAR_DEMO_PROPERTY_ID,
            signal,
          }),
        ]
      : await dataset.listProperties({ limit: 20, signal });
    for (const property of catalog) {
      if (!property.location.value || !property.rentableAreaSqft.value)
        continue;
      try {
        selectCommercialModel(
          mapping,
          property.id,
          process.env.MATTERPORT_REVIEWED_MODEL_ID || undefined,
        );
        return { property, mapping };
      } catch {
        continue;
      }
    }
    throw new ProviderError(
      "DATA_MISMATCH",
      "No reviewed, unambiguous commercial property/model pair is configured.",
    );
  }
  const selected = (signal: AbortSignal) => (selection ??= select(signal));
  const property: PropertyProvider = {
    async listProperties({ signal }) {
      return [(await selected(signal)).property];
    },
    async getProperty({ propertyId, signal }) {
      const p = (await selected(signal)).property;
      if (p.id !== propertyId)
        throw new ProviderError(
          "NOT_FOUND",
          "Property not in the permitted demo catalog.",
        );
      return p;
    },
  };
  const spatial = new MatterportSpatialProvider(
    new MatterportClient({
      apiKey: process.env.MATTERPORT_API_KEY,
      apiToken: process.env.MATTERPORT_API_TOKEN,
      agreementAccepted: true,
    }),
    async (signal) => (await selected(signal)).mapping,
    {
      reviewedModelId: process.env.MATTERPORT_REVIEWED_MODEL_ID || undefined,
      permissions: permitted,
    },
  );
  return { property, spatial };
}
