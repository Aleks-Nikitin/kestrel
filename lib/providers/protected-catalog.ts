import "server-only";
import { z } from "zod";
import { Property, ShowcasePublication, Id, type PropertyProvider, type SpatialProvider } from "@/lib/contracts";
import { MatterportClient } from "./matterport/client";
import { MatterportSpatialProvider } from "./matterport/spatial";
import { ProviderError } from "./errors";

const Record = z.strictObject({
  property: Property,
  modelMapping: z.strictObject({ propertyId: Id, modelId: Id, source: z.literal("commercial_property_mapping"), showcase: ShowcasePublication.optional() }),
});
type Permissions = { display: boolean; modelProcessing: boolean; export: boolean };
/** Bounded, owner-curated runtime projections; no dataset or model IDs in source. */
export function createProtectedCatalog(
  base: unknown,
  additions: unknown,
  authorization: { agreementAccepted: boolean; permissions: Permissions },
  client: MatterportClient,
): { property: PropertyProvider; spatial: SpatialProvider } {
  if (!authorization.agreementAccepted || !authorization.permissions.display)
    throw new ProviderError("LICENSE_RESTRICTED", "Authorized agreement and display permission are required.");
  const extra = z.array(Record).max(3).safeParse(additions);
  const first = Record.safeParse(base);
  if (!first.success || !extra.success)
    throw new ProviderError("DATA_MISMATCH", "Protected catalog configuration is invalid.");
  const records = [first.data, ...extra.data];
  const ids = new Set<string>(), models = new Set<string>();
  for (const r of records) {
    if (r.property.id !== r.modelMapping.propertyId || ids.has(r.property.id) || models.has(r.modelMapping.modelId) || (r.modelMapping.showcase && r.modelMapping.showcase.sid !== r.modelMapping.modelId))
      throw new ProviderError("DATA_MISMATCH", "Protected catalog identities are conflicting or duplicated.");
    ids.add(r.property.id); models.add(r.modelMapping.modelId);
    r.property.dataMode = "licensed_cache";
    r.property.evidence = r.property.evidence.map(e => ({ ...e, allowedUse: authorization.permissions }));
  }
  const byId = new Map(records.map(r => [r.property.id, r]));
  const matches = records.map(r => r.modelMapping);
  const layers = new Map(records.map(r => [r.property.id, new MatterportSpatialProvider(client, async () => matches, { permissions: authorization.permissions, showcase: r.modelMapping.showcase })]));
  return {
    property: {
      async listProperties({ limit, signal }) {
        signal.throwIfAborted();
        if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new ProviderError("INVALID_INPUT", "Catalog limit is invalid.");
        return records.slice(0, limit).map(r => r.property);
      },
      async getProperty({ propertyId, signal }) {
        signal.throwIfAborted();
        const r = byId.get(propertyId);
        if (!r) throw new ProviderError("NOT_FOUND", "Property not in the permitted catalog.");
        return r.property;
      },
    },
    spatial: {
      async getSpatialContext({ property, signal }) {
        signal.throwIfAborted();
        const r = byId.get(property.id), layer = layers.get(property.id);
        if (!r || !layer) throw new ProviderError("DATA_MISMATCH", "No approved spatial binding for this property.");
        // Use the catalog's authoritative property, never caller-supplied facts.
        return layer.getSpatialContext({ property: r.property, signal });
      },
    },
  };
}
