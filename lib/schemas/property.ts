import { z } from "zod";
import Decimal from "decimal.js";
import {
  Id,
  Text,
  Instant,
  DateOnly,
  Amount,
  Ratio,
  Coordinates,
  Evidence,
  DataMode,
  datum,
} from "./primitives";
/** Server-approved hosted Showcase location; shape validation is not sweep verification. */
export const ShowcaseStartView = z.strictObject({
  ss: z.string().regex(/^\d{1,4}$/),
  sr: z.string().regex(/^(-?(?:\d{1,3}(?:\.\d{1,4})?|\.\d{1,4}))?,(-?(?:\d{1,3}(?:\.\d{1,4})?|\.\d{1,4}))?$/).refine(value => value !== ",").optional(),
});
export const ShowcasePublication = z.strictObject({
  sid: Id,
  verifiedAt: Instant,
  startView: ShowcaseStartView.optional(),
});
const DocumentedConstraint = z.strictObject({
  id: Id,
  dimension: z.enum(["legal", "physical"]),
  appliesToUses: z.array(Text).min(1),
  finding: z.enum(["supported", "excluded"]),
  explanation: Text,
  evidenceIds: z.array(Id).min(1),
});
export const PropertyShape = {
  id: Id,
  address: datum(Text, "text"),
  location: datum(Coordinates, "WGS84"),
  propertyType: datum(Text, "text"),
  existingUse: datum(Text, "text"),
  grossAreaSqft: datum(Amount, "sqft"),
  rentableAreaSqft: datum(Amount, "sqft"),
  yearBuilt: datum(z.number().int().min(1600).max(2200), "count"),
  floors: datum(z.number().int().positive().max(500), "count"),
  occupancyRatio: datum(Ratio, "ratio"),
  marketRentAnnualPerSqft: datum(Amount, "USD/sqft/year"),
  marketDescription: datum(Text, "text"),
  documentedConstraints: z.array(DocumentedConstraint).max(100),
  evidence: z.array(Evidence).max(200),
  dataMode: DataMode,
};
export function validateEvidence(
  propertyId: string,
  evidence: z.infer<typeof Evidence>[],
  refs: string[],
  ctx: z.RefinementCtx,
) {
  const ids = new Set(evidence.map((e) => e.id));
  if (
    ids.size !== evidence.length ||
    evidence.some(
      (e) =>
        e.propertyId !== propertyId ||
        e.parentEvidenceIds.some((id) => !ids.has(id) || id === e.id),
    ) ||
    refs.some((id) => !ids.has(id))
  )
    ctx.addIssue({
      code: "custom",
      message: "Evidence references must resolve uniquely for this property",
    });
}
export const Property = z.strictObject(PropertyShape).superRefine((p, ctx) => {
  const refs = [
    p.address,
    p.location,
    p.propertyType,
    p.existingUse,
    p.grossAreaSqft,
    p.rentableAreaSqft,
    p.yearBuilt,
    p.floors,
    p.occupancyRatio,
    p.marketRentAnnualPerSqft,
    p.marketDescription,
  ]
    .flatMap((d) => d.evidenceIds)
    .concat(p.documentedConstraints.flatMap((c) => c.evidenceIds));
  validateEvidence(p.id, p.evidence, refs, ctx);
  if (
    p.grossAreaSqft.value !== null &&
    p.rentableAreaSqft.value !== null &&
    new Decimal(p.rentableAreaSqft.value).gt(p.grossAreaSqft.value)
  )
    ctx.addIssue({
      code: "custom",
      path: ["rentableAreaSqft"],
      message: "Rentable area exceeds gross area",
    });
});
export const PropertySummary = z.strictObject({
  id: Id,
  address: PropertyShape.address,
  location: PropertyShape.location,
  propertyType: PropertyShape.propertyType,
  dataMode: DataMode,
  evidence: z.array(Evidence),
});
const Position = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const Ring = z
  .array(Position)
  .min(4)
  .max(1000)
  .refine(
    (r) => r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1],
    "Polygon ring must be closed",
  );
const Polygon = z.array(Ring).min(1).max(50);
export const Footprint = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("Polygon"), coordinates: Polygon }),
  z.strictObject({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(Polygon).min(1).max(100),
  }),
]);
export const SpatialContext = z
  .strictObject({
    propertyId: Id,
    provider: z.enum(["vexcel", "matterport"]),
    dataMode: z.enum(["live", "licensed_cache", "synthetic", "unavailable"]),
    match: z.strictObject({
      status: z.enum(["verified", "ambiguous", "unmatched"]),
      method: z.enum(["provider_link", "geographic_review"]),
      evidenceIds: z.array(Id),
      reviewedAt: Instant.nullable(),
      explanation: Text,
    }),
    imagery: z
      .strictObject({
        assetId: Id,
        displayPath: z
          .string()
          .regex(
            /^\/api\/v1\/properties\/[A-Za-z0-9_.:-]+\/media\/[A-Za-z0-9_.:-]+$/,
          ),
        capturedAt: Instant.nullable(),
        footprintGeoJSON: Footprint.nullable(),
        attribution: Text.min(1),
      })
      .nullable(),
    observations: z
      .array(
        z.strictObject({
          id: Id,
          statement: Text,
          origin: z.enum(["source_data", "explicit_estimate"]),
          evidenceIds: z.array(Id).min(1),
          limitations: z.array(Text),
        }),
      )
      .max(100),
    model: z
      .strictObject({
        id: Id,
        joinSource: z.enum(["costar_property_id", "geographic_review"]),
        commercialPropertyId: Id.nullable(),
        dimensionsUnit: z.literal("m"),
        areaUnit: z.literal("m2"),
        rooms: z
          .array(
            z.strictObject({
              id: Id,
              width: Amount.nullable(),
              depth: Amount.nullable(),
              height: Amount.nullable(),
              floorArea: Amount.nullable(),
            }),
          )
          .max(500),
        conversionNote: Text,
        signedUrlExpiresAt: Instant.nullable(),
        // Present only after trusted server verification of Showcase publication.
        showcase: ShowcasePublication.optional(),
      })
      .nullable(),
    evidence: z.array(Evidence).max(200),
    unavailableReason: Text.nullable(),
  })
  .superRefine((s, ctx) => {
    validateEvidence(
      s.propertyId,
      s.evidence,
      [...s.match.evidenceIds, ...s.observations.flatMap((o) => o.evidenceIds)],
      ctx,
    );
    if (
      s.match.status !== "verified" &&
      (s.imagery || s.observations.length || s.model)
    )
      ctx.addIssue({
        code: "custom",
        message: "Unmatched layers cannot supply property claims or assets",
      });
    if (s.dataMode === "unavailable" && !s.unavailableReason)
      ctx.addIssue({
        code: "custom",
        message: "Unavailable layer requires reason",
      });
    if (
      s.match.status === "verified" &&
      (!s.match.evidenceIds.length || !s.match.reviewedAt)
    )
      ctx.addIssue({
        code: "custom",
        message: "Verified match requires dated evidence",
      });
    if (
      s.model?.showcase &&
      (s.model.showcase.sid !== s.model.id ||
        s.provider !== "matterport" ||
        s.match.status !== "verified")
    )
      ctx.addIssue({
        code: "custom",
        path: ["model", "showcase"],
        message: "Showcase proof must identify the verified Matterport model",
      });
    if (
      s.model?.joinSource === "costar_property_id" &&
      s.model.commercialPropertyId !== s.propertyId
    )
      ctx.addIssue({
        code: "custom",
        message: "Explicit commercial ID must match selected property",
      });
  });
export const CatalogResponse = z.strictObject({
  contractVersion: z.literal("1"),
  properties: z.array(PropertySummary).max(100),
  nextCursor: z.null(),
});
export { DateOnly };
