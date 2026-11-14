import "server-only";
import { z } from "zod";
import Decimal from "decimal.js";
import { Property, type PropertyDTO } from "@/lib/contracts";
import { ProviderError } from "../errors";
const maybeNumber = z.number().finite().nonnegative().nullable().optional();
const SourceAddress = z.object({
  streetNumber: z.string().nullable().optional(),
  streetName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
});
const AreaBlock = z
  .object({ rentableBuildingAreaSquareFeet: maybeNumber })
  .nullable()
  .optional();
// Narrow projection only: contacts, descriptions and signed asset links never cross this adapter.
export const CommercialRecord = z.object({
  id: z.number().int().positive().safe(),
  propertyType: z.number().int(),
  constructionStatus: z.number().int(),
  primaryAddress: SourceAddress.nullable().optional(),
  grossBuildingAreaSquareFeet: maybeNumber,
  rentableBuildingAreaSquareFeet: maybeNumber,
  numStoriesAboveGrade: z.number().int().positive().nullable().optional(),
  constructionEvents: z
    .array(z.object({ eventType: z.number().int(), year: z.number().int() }))
    .optional(),
  propertyOffice: AreaBlock,
  propertyIndustrial: AreaBlock,
  propertyFlex: AreaBlock,
  propertyRetail: z
    .object({ grossLeasableAreaSquareFeet: maybeNumber })
    .nullable()
    .optional(),
});
export type CommercialRecordDTO = z.infer<typeof CommercialRecord>;
export const supportedUses: Readonly<Record<number, string>> = {
  2: "Industrial",
  5: "Office",
  6: "Retail",
  7: "Flex",
};
export function isSupportedCommercial(record: CommercialRecordDTO) {
  return (
    record.constructionStatus === 1 && record.propertyType in supportedUses
  );
}
export function normalizeCommercialProperty(
  raw: unknown,
  retrievedAt: string,
  permissions: { display: boolean; modelProcessing: boolean; export: boolean },
): PropertyDTO {
  const parsed = CommercialRecord.safeParse(raw);
  if (!parsed.success)
    throw new ProviderError(
      "DATA_MISMATCH",
      "The commercial record does not match the documented dataset shape.",
    );
  const r = parsed.data,
    id = String(r.id),
    evidenceId = `costar-dataset-${id}`;
  const fact = <T>(
    value: T | null | undefined,
    unit: string,
    path: string,
  ) => ({
    value: value ?? null,
    origin: value == null ? "unknown" : "source_data",
    unit,
    evidenceIds: value == null ? [] : [evidenceId],
    recordedAt: retrievedAt,
    sourceAsOf: null,
    note:
      value == null
        ? `Not supplied by the dataset: ${path}.`
        : `Dataset field: ${path}; source research date unavailable.`,
  });
  const decimal = (n: number | null | undefined) =>
    n == null ? null : new Decimal(String(n)).toFixed();
  const a = r.primaryAddress;
  const street = [a?.streetNumber, a?.streetName].filter(Boolean).join(" ");
  const address = street
    ? [street, a?.city, a?.state, a?.postcode].filter(Boolean).join(", ")
    : null;
  let area = r.rentableBuildingAreaSquareFeet;
  let areaPath = "rentableBuildingAreaSquareFeet";
  if (area == null) {
    const subtype =
      r.propertyType === 5
        ? r.propertyOffice
        : r.propertyType === 2
          ? r.propertyIndustrial
          : r.propertyType === 7
            ? r.propertyFlex
            : null;
    if (subtype?.rentableBuildingAreaSquareFeet != null) {
      area = subtype.rentableBuildingAreaSquareFeet;
      areaPath = "type-specific rentableBuildingAreaSquareFeet";
    }
    if (
      r.propertyType === 6 &&
      r.propertyRetail?.grossLeasableAreaSquareFeet != null
    ) {
      area = r.propertyRetail.grossLeasableAreaSquareFeet;
      areaPath =
        "propertyRetail.grossLeasableAreaSquareFeet (retail lease basis)";
    }
  }
  const completionYears = [
    ...new Set(
      r.constructionEvents
        ?.filter((e) => e.eventType === 2)
        .map((e) => e.year) ?? [],
    ),
  ];
  const year = completionYears.length === 1 ? completionYears[0] : null;
  const result = Property.safeParse({
    id,
    address: fact(
      address,
      "text",
      "primaryAddress (available address components)",
    ),
    location: fact(
      a?.latitude != null && a?.longitude != null
        ? { longitude: a.longitude, latitude: a.latitude }
        : null,
      "WGS84",
      "primaryAddress.longitude/latitude",
    ),
    propertyType: fact(
      supportedUses[r.propertyType] ?? null,
      "text",
      "propertyType",
    ),
    existingUse: fact(
      supportedUses[r.propertyType] ?? null,
      "text",
      "propertyType (recorded building classification, not a legal-use approval)",
    ),
    grossAreaSqft: fact(
      decimal(r.grossBuildingAreaSquareFeet),
      "sqft",
      "grossBuildingAreaSquareFeet",
    ),
    rentableAreaSqft: fact(decimal(area), "sqft", areaPath),
    yearBuilt: fact(
      year,
      "count",
      "constructionEvents[eventType=2].year; ambiguous events remain unknown",
    ),
    floors: fact(r.numStoriesAboveGrade, "count", "numStoriesAboveGrade"),
    occupancyRatio: fact(null, "ratio", "occupancyRatio"),
    marketRentAnnualPerSqft: fact(
      null,
      "USD/sqft/year",
      "compatible annual gross market rent",
    ),
    marketDescription: fact(null, "text", "marketDescription"),
    documentedConstraints: [],
    evidence: [
      {
        id: evidenceId,
        provider: "costar",
        recordId: id,
        propertyId: id,
        kind: "record",
        label: "CoStar sanctioned dataset extract; not an API-live retrieval",
        retrievedAt,
        sourceAsOf: null,
        sourceUrl: null,
        synthetic: false,
        parentEvidenceIds: [],
        allowedUse: permissions,
      },
    ],
    dataMode: "sponsor_dataset",
  });
  if (!result.success)
    throw new ProviderError(
      "DATA_MISMATCH",
      "The commercial record has invalid area, units, dates or provenance.",
    );
  return result.data;
}
