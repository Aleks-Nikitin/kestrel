import "server-only";
import Decimal from "decimal.js";
import {
  SpatialContext,
  type PropertyDTO,
  type SpatialProvider,
  type SpatialContextDTO,
} from "@/lib/contracts";
import { ProviderError } from "../errors";
import {
  selectCommercialModel,
  type CommercialModelMatch,
} from "../costar/mapping";
import { MatterportClient, type MatterportModelDTO } from "./client";
const Arithmetic = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});
export const SQFT_PER_SQUARE_METRE = "10.763910416709722308";
export function normalizeMatchedSpatial(
  property: PropertyDTO,
  match: CommercialModelMatch,
  model: MatterportModelDTO,
  retrievedAt: string,
  permissions: { display: boolean; modelProcessing: boolean; export: boolean },
): SpatialContextDTO {
  if (match.propertyId !== property.id || match.modelId !== model.id)
    throw new ProviderError(
      "DATA_MISMATCH",
      "The model does not match the selected commercial property.",
    );
  const coordinates = property.location.value,
    location = model.geolocation;
  // Gross coordinate disagreement is a rejection guard, never proof of a same-building match.
  if (
    coordinates &&
    location?.lat != null &&
    location.long != null &&
    (Math.abs(coordinates.latitude - location.lat) > 0.01 ||
      Math.abs(coordinates.longitude - location.long) > 0.01)
  )
    throw new ProviderError(
      "DATA_MISMATCH",
      "Mapped model coordinates conflict with the property; manual review is required.",
    );
  const joinEvidenceId = `commercial-join-${property.id}-${model.id}`;
  const modelEvidenceId = `matterport-model-${model.id}`;
  const amount = (n: number | null | undefined) =>
    n == null ? null : new Arithmetic(String(n)).toDecimalPlaces(8).toFixed();
  const rooms = (model.rooms ?? []).map((r) => ({
    id: r.id,
    width: amount(r.dimensions?.width),
    depth: amount(r.dimensions?.depth),
    height: amount(r.dimensions?.height),
    floorArea: amount(r.dimensions?.areaFloor),
  }));
  const measured = rooms.filter((r) => r.floorArea !== null);
  const scannedArea = measured.reduce(
    (sum, r) => sum.plus(r.floorArea!),
    new Arithmetic(0),
  );
  const evidenceIds = [joinEvidenceId, modelEvidenceId];
  const observations = measured.length
    ? [
        {
          id: "room-estimate-coverage",
          statement: `${measured.length} matched rooms have floor-area estimates totaling ${scannedArea.toFixed()} m2 (${scannedArea.times(SQFT_PER_SQUARE_METRE).toDecimalPlaces(2).toFixed()} sqft). The CoStar rentable area is ${property.rentableAreaSqft.value ?? "unknown"} sqft. Verify scan coverage and conversion layout before using room dimensions to screen a proposed use.`,
          origin: "source_data" as const,
          evidenceIds,
          limitations: [
            "Matterport dimensions are estimates, not a survey or structural certification.",
            "Scanned room areas may cover only part of the building and use a different measurement basis from rentable area.",
            "Room area is not substituted for CoStar rentable building area or legal-use evidence.",
          ],
        },
      ]
    : [];
  const source = {
    propertyId: property.id,
    kind: "record" as const,
    retrievedAt,
    sourceAsOf: null,
    sourceUrl: null,
    synthetic: false,
    allowedUse: permissions,
  };
  const parsed = SpatialContext.safeParse({
    propertyId: property.id,
    provider: "matterport",
    dataMode: "live",
    match: {
      status: "verified",
      method: "provider_link",
      evidenceIds: [joinEvidenceId],
      reviewedAt: retrievedAt,
      explanation:
        "Explicit sponsor commercial PropertyId/MatterportModelId mapping; response model ID checked. Coordinates are corroboration only.",
    },
    imagery: null,
    observations,
    model: {
      id: model.id,
      joinSource: "costar_property_id",
      commercialPropertyId: property.id,
      dimensionsUnit: "m",
      areaUnit: "m2",
      rooms,
      conversionNote: `Metric room estimates; 1 m2 = ${SQFT_PER_SQUARE_METRE} sqft. Values rounded to at most eight decimal places; no rentable-area substitution.`,
      signedUrlExpiresAt: null,
    },
    evidence: [
      {
        ...source,
        id: joinEvidenceId,
        provider: "costar",
        recordId: property.id,
        label: "Explicit commercial property/model mapping from sanctioned kit",
        parentEvidenceIds: [],
      },
      {
        ...source,
        id: modelEvidenceId,
        provider: "matterport",
        recordId: model.id,
        label:
          "Live GraphQL room-dimension estimates; metric units explicitly requested",
        parentEvidenceIds: [joinEvidenceId],
      },
    ],
    unavailableReason: null,
  });
  if (!parsed.success)
    throw new ProviderError(
      "DATA_MISMATCH",
      "Matched spatial evidence failed the shared contract.",
    );
  return parsed.data;
}
export class MatterportSpatialProvider implements SpatialProvider {
  constructor(
    private readonly client: MatterportClient,
    private readonly mapping: (
      signal: AbortSignal,
    ) => Promise<CommercialModelMatch[]>,
    private readonly options: {
      reviewedModelId?: string;
      showcase?: {sid:string;verifiedAt:string};
      permissions: {
        display: boolean;
        modelProcessing: boolean;
        export: boolean;
      };
      now?: () => Date;
    },
  ) {}
  async getSpatialContext({
    property,
    signal,
  }: {
    property: PropertyDTO;
    signal: AbortSignal;
  }): Promise<SpatialContextDTO> {
    const match = selectCommercialModel(
      await this.mapping(signal),
      property.id,
      this.options.reviewedModelId,
    );
    const model = await this.client.getModel(match.modelId, signal);
    const spatial = normalizeMatchedSpatial(
      property,
      match,
      model,
      (this.options.now?.() ?? new Date()).toISOString(),
      this.options.permissions,
    );
    if(this.options.showcase) {
      if(this.options.showcase.sid!==model.id) throw new ProviderError("DATA_MISMATCH","Showcase proof does not match the selected model.");
      return SpatialContext.parse({...spatial,model:{...spatial.model!,showcase:this.options.showcase}});
    }
    return spatial;
  }
}
