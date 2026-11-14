// Browser-safe schema for the temporary, synthetic-only S05/S07 runtime proof.
import { z } from "zod";
import { DecimalString, Id, ModelUsage } from "@/lib/contracts";
export const SyntheticSampleInput = z.strictObject({
  areaSqft: DecimalString,
  annualRentPerSqft: DecimalString,
  occupancyRatio: DecimalString,
  annualExpenses: DecimalString,
});
export const SyntheticSampleResult = z.strictObject({
  potentialRent: DecimalString,
  effectiveGrossIncome: DecimalString,
  noi: DecimalString,
  currency: z.literal("USD"),
  period: z.literal("stabilized_annual"),
  dataMode: z.literal("synthetic"),
});
export const SyntheticSpikeResponse = z.strictObject({
  contractVersion: z.literal("1"),
  dataMode: z.literal("synthetic"),
  canonicalResult: SyntheticSampleResult,
  explanation: z.string().max(2000),
  modelUsage: ModelUsage,
  execution: z.strictObject({
    requestId: Id,
    elapsedMs: z.number().int().nonnegative().max(60000),
    completedTools: z
      .array(
        z.strictObject({
          name: z.enum(["write_todos", "calculateSample", "read_file"]),
          toolCallId: Id,
        }),
      )
      .max(16),
    effectiveToolInventory: z
      .array(z.enum(["write_todos", "calculateSample", "read_file"]))
      .max(3),
    modelAttempts: z.number().int().min(1).max(8),
    nativePlanningObserved: z.literal(true),
    fallbackAvailability: z.enum([
      "configured",
      "unavailable: not configured",
      "disabled",
    ]),
  }),
});
export type SyntheticSpikeResponseDTO = z.infer<typeof SyntheticSpikeResponse>;
