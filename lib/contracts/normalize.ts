import "server-only";
import { createHash } from "node:crypto";
import {
  Constraints,
  Scenario,
  type PropertyDTO,
  type ScenarioInputDTO,
  type ScenarioDTO,
  type ConstraintsInputDTO,
  type ConstraintsDTO,
  type Evidence,
} from "@/lib/contracts";
import type { z } from "zod";
type EvidenceDTO = z.infer<typeof Evidence>;
interface Options {
  inputRevision: number;
  now?: string;
}
function normalizer(propertyId: string, options: Options) {
  const now = options.now ?? new Date().toISOString();
  const evidence: EvidenceDTO[] = [];
  function value(
    input: { value: unknown; note?: string; acceptedEstimate?: boolean },
    unit: string,
    path: string,
    source?: {
      value: unknown;
      origin: string;
      evidenceIds: string[];
      unit: string;
      recordedAt: string;
      sourceAsOf: string | null;
      note: string | null;
    },
  ) {
    if (input.value === null)
      return {
        value: null,
        unit,
        origin: "unknown",
        evidenceIds: [],
        recordedAt: now,
        sourceAsOf: null,
        note:
          input.note?.trim() ||
          "This input is unknown or unset; no zero has been assumed.",
      };
    if (
      source &&
      source.value !== null &&
      source.value === input.value &&
      !input.acceptedEstimate &&
      !input.note?.trim()
    )
      return { ...source };
    const id =
      "input-" +
      createHash("sha256")
        .update(
          JSON.stringify([
            propertyId,
            options.inputRevision,
            path,
            input.value,
          ]),
        )
        .digest("hex")
        .slice(0, 24);
    evidence.push({
      id,
      provider: "user",
      recordId: null,
      propertyId,
      kind: "assumption",
      label: `${path}: ${input.acceptedEstimate ? "user-accepted assumption" : "user input"}`,
      retrievedAt: now,
      sourceAsOf: null,
      sourceUrl: null,
      synthetic: false,
      parentEvidenceIds: source?.evidenceIds ?? [],
      allowedUse: { display: true, modelProcessing: true, export: true },
    });
    return {
      value: input.value,
      unit,
      origin: "user_input",
      evidenceIds: [id],
      recordedAt: now,
      sourceAsOf: null,
      note:
        input.note?.trim() ||
        (input.acceptedEstimate
          ? "User explicitly accepted this assumption; it is not verified source data."
          : "User-entered assumption; verify before investment."),
    };
  }
  return { value, evidence };
}
export function normalizeScenarioInputs(
  property: PropertyDTO,
  inputs: ScenarioInputDTO[],
  options: Options,
): { scenarios: ScenarioDTO[]; evidence: EvidenceDTO[] } {
  const n = normalizer(property.id, options);
  const scenarios = inputs.map((s) => {
    const v = (
      key: keyof ScenarioInputDTO,
      unit: string,
      source?: Parameters<typeof n.value>[3],
    ) =>
      n.value(
        s[key] as { value: unknown; note?: string; acceptedEstimate?: boolean },
        unit,
        `${s.id}.${key}`,
        source,
      );
    const annual = (input: { value: unknown; note?: string }, path: string) =>
      n.value(input, "USD/year", `${s.id}.${path}`);
    const normalized = {
      ...s,
      rentableAreaSqft: v(
        "rentableAreaSqft",
        "sqft",
        property.rentableAreaSqft,
      ),
      annualRentPerSqft: v(
        "annualRentPerSqft",
        "USD/sqft/year",
        property.marketRentAnnualPerSqft,
      ),
      occupancyRatio: v("occupancyRatio", "ratio", property.occupancyRatio),
      collectionLossRatio: v("collectionLossRatio", "ratio"),
      annualConcessions: v("annualConcessions", "USD/year"),
      otherPotentialAnnualIncome: v("otherPotentialAnnualIncome", "USD/year"),
      otherEffectiveAnnualIncome: v("otherEffectiveAnnualIncome", "USD/year"),
      operatingExpenses:
        s.operatingExpenses.mode === "total"
          ? {
              mode: "total",
              annualAmount: annual(
                s.operatingExpenses.annualAmount,
                "operatingExpenses.annualAmount",
              ),
            }
          : {
              mode: "itemized",
              items: s.operatingExpenses.items.map((i) => ({
                ...i,
                annualAmount: annual(
                  i.annualAmount,
                  `operatingExpenses.${i.id}`,
                ),
              })),
            },
      capex: Object.fromEntries(
        Object.entries(s.capex).map(([key, input]) => [
          key,
          n.value(input, "USD", `${s.id}.capex.${key}`),
        ]),
      ),
      totalProjectCost: n.value(
        s.totalProjectCost,
        "USD",
        `${s.id}.totalProjectCost`,
      ),
    };
    // A cost basis must be disclosed, not inferred from the entered amount.
    if (s.totalProjectCost.value !== null && !s.totalProjectCost.note?.trim()) {
      normalized.totalProjectCost.note = null;
    }
    return Scenario.parse(normalized);
  });
  return { scenarios, evidence: n.evidence };
}
export function normalizeConstraintsInputs(
  propertyId: string,
  input: ConstraintsInputDTO,
  options: Options,
): { constraints: ConstraintsDTO; evidence: EvidenceDTO[] } {
  const n = normalizer(propertyId, options);
  return {
    constraints: Constraints.parse({
      ...input,
      maxInitialInvestment: n.value(
        input.maxInitialInvestment,
        "USD",
        "constraints.maxInitialInvestment",
      ),
      maxPaybackYears: n.value(
        input.maxPaybackYears,
        "years",
        "constraints.maxPaybackYears",
      ),
      minimumYieldOnCost: n.value(
        input.minimumYieldOnCost,
        "ratio",
        "constraints.minimumYieldOnCost",
      ),
    }),
    evidence: n.evidence,
  };
}
