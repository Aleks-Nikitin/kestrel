import { z } from "zod";
import Decimal from "decimal.js";
export const Id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
export const Text = z.string().max(2000);
export const Instant = z.iso.datetime();
export const DateOnly = z.iso.date();
export const DecimalString = z
  .string()
  .max(22)
  .regex(/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/);
export const Amount = DecimalString.refine(
  (v) => new Decimal(v).gte(0),
  "Must be nonnegative",
);
export const Positive = Amount.refine(
  (v) => new Decimal(v).gt(0),
  "Must be positive",
);
export const Ratio = Amount.refine(
  (v) => new Decimal(v).lte(1),
  "Must be between zero and one",
);
export const Unit = z.enum([
  "USD",
  "USD/year",
  "USD/sqft/year",
  "sqft",
  "ratio",
  "years",
  "count",
  "text",
  "date",
  "WGS84",
]);
export const Coordinates = z.strictObject({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});
export const Period = z
  .strictObject({
    start: DateOnly,
    end: DateOnly,
    basis: z.literal("stabilized_annual"),
  })
  .refine((p) => {
    const start = new Date(p.start + "T00:00:00Z");
    start.setUTCFullYear(start.getUTCFullYear() + 1);
    return start.toISOString().slice(0, 10) === p.end;
  }, "Period must be exactly one calendar year, end exclusive");
export function datum<T extends z.ZodType, U extends z.infer<typeof Unit>>(
  value: T,
  unit: U,
) {
  return z
    .strictObject({
      value: value.nullable(),
      origin: z.enum([
        "source_data",
        "user_input",
        "derived_calculation",
        "explicit_estimate",
        "unknown",
      ]),
      unit: z.literal(unit),
      evidenceIds: z.array(Id).max(100),
      recordedAt: Instant,
      sourceAsOf: DateOnly.nullable(),
      note: Text.nullable(),
    })
    .superRefine((d, ctx) => {
      const value = (d as { value?: unknown }).value;
      if (d.origin === "unknown" ? value !== null || !d.note : value === null)
        ctx.addIssue({
          code: "custom",
          message: "Unknown requires null and a note; known requires a value",
        });
      if (d.origin === "source_data" && !d.evidenceIds.length)
        ctx.addIssue({
          code: "custom",
          message: "Source data requires evidence",
        });
    });
}
export function inputValue<T extends z.ZodType>(
  value: T,
  _unit?: z.infer<typeof Unit>,
) {
  void _unit;
  return z.strictObject({
    value: value.nullable(),
    acceptedEstimate: z.boolean().optional(),
    note: Text.optional(),
  });
}
export const SafeLink = z
  .string()
  .max(1000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash
      );
    } catch {
      return false;
    }
  }, "Only credential-free HTTPS links without query strings are allowed");
export const Evidence = z.strictObject({
  id: Id,
  provider: z.enum([
    "costar",
    "vexcel",
    "matterport",
    "user",
    "calculation",
    "model",
  ]),
  recordId: Id.nullable(),
  propertyId: Id,
  kind: z.enum(["record", "image", "observation", "assumption", "calculation"]),
  label: Text,
  retrievedAt: Instant,
  sourceAsOf: DateOnly.nullable(),
  sourceUrl: SafeLink.nullable(),
  synthetic: z.boolean(),
  parentEvidenceIds: z.array(Id).max(100),
  allowedUse: z.strictObject({
    display: z.boolean(),
    modelProcessing: z.boolean(),
    export: z.boolean(),
  }),
});
export const DataMode = z.enum([
  "live",
  "licensed_cache",
  "sponsor_dataset",
  "synthetic",
]);
export const FinancialDecimal = z
  .string()
  .max(80)
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
