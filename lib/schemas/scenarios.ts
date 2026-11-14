import { z } from "zod";
import Decimal from "decimal.js";
import {
  Id,
  Text,
  Period,
  datum,
  inputValue,
  Amount,
  Positive,
  Ratio,
} from "./primitives";
const Category = z.enum([
  "taxes",
  "insurance",
  "management",
  "utilities",
  "maintenance",
  "other",
]);
function responseScenarioShape() {
  const money = () => datum(Amount, "USD");
  const annual = () => datum(Amount, "USD/year");
  const shape = {
    id: Id,
    propertyId: Id,
    role: z.enum(["baseline", "alternative"]),
    name: Text.min(1),
    proposedUse: Text.min(1),
    leaseBasis: z.enum(["gross", "modified_gross", "nnn", "unknown"]),
    rentNormalizationNote: Text.nullable(),
    period: Period,
    currency: z.literal("USD"),
    rentableAreaSqft: datum(Positive, "sqft"),
    annualRentPerSqft: datum(Amount, "USD/sqft/year"),
    occupancyRatio: datum(Ratio, "ratio"),
    collectionLossRatio: datum(Ratio, "ratio"),
    annualConcessions: annual(),
    otherPotentialAnnualIncome: annual(),
    otherEffectiveAnnualIncome: annual(),
    operatingExpenses: z.discriminatedUnion("mode", [
      z.strictObject({
        mode: z.literal("itemized"),
        items: z
          .array(
            z.strictObject({
              id: Id,
              category: Category,
              label: Text.min(1),
              annualAmount: annual(),
            }),
          )
          .max(50),
      }),
      z.strictObject({ mode: z.literal("total"), annualAmount: annual() }),
    ]),
    capex: z.strictObject({
      renovation: money(),
      conversion: money(),
      softCosts: money(),
      contingency: money(),
      other: money(),
    }),
    totalProjectCost: datum(Positive, "USD"),
    assumptions: z.array(Text).max(50),
  };
  return shape;
}
function requestScenarioShape() {
  const money = () => inputValue(Amount, "USD");
  const annual = () => inputValue(Amount, "USD/year");
  const shape = {
    id: Id,
    propertyId: Id,
    role: z.enum(["baseline", "alternative"]),
    name: Text.min(1),
    proposedUse: Text.min(1),
    leaseBasis: z.enum(["gross", "modified_gross", "nnn", "unknown"]),
    rentNormalizationNote: Text.nullable(),
    period: Period,
    currency: z.literal("USD"),
    rentableAreaSqft: inputValue(Positive, "sqft"),
    annualRentPerSqft: inputValue(Amount, "USD/sqft/year"),
    occupancyRatio: inputValue(Ratio, "ratio"),
    collectionLossRatio: inputValue(Ratio, "ratio"),
    annualConcessions: annual(),
    otherPotentialAnnualIncome: annual(),
    otherEffectiveAnnualIncome: annual(),
    operatingExpenses: z.discriminatedUnion("mode", [
      z.strictObject({
        mode: z.literal("itemized"),
        items: z
          .array(
            z.strictObject({
              id: Id,
              category: Category,
              label: Text.min(1),
              annualAmount: annual(),
            }),
          )
          .max(50),
      }),
      z.strictObject({ mode: z.literal("total"), annualAmount: annual() }),
    ]),
    capex: z.strictObject({
      renovation: money(),
      conversion: money(),
      softCosts: money(),
      contingency: money(),
      other: money(),
    }),
    totalProjectCost: inputValue(Positive, "USD"),
    assumptions: z.array(Text).max(50),
  };
  return shape;
}
function validateScenario(
  s: {
    role: string;
    capex: Record<string, { value: string | null }>;
    totalProjectCost: { value: string | null };
    otherPotentialAnnualIncome: { value: string | null };
    otherEffectiveAnnualIncome: { value: string | null };
    operatingExpenses: {
      mode: string;
      annualAmount?: { value: string | null; note?: string | null };
      items?: { id: string; category: string; label: string }[];
    };
  },
  ctx: z.RefinementCtx,
) {
  const capex = Object.values(s.capex);
  if (
    s.role === "baseline" &&
    capex.some((v) => v.value !== null && !new Decimal(v.value).isZero())
  )
    ctx.addIssue({
      code: "custom",
      path: ["capex"],
      message: "Baseline investment must be zero",
    });
  if (
    s.totalProjectCost.value !== null &&
    capex.every((v) => v.value !== null) &&
    new Decimal(s.totalProjectCost.value).lt(
      capex.reduce((n, v) => n.plus(v.value!), new Decimal(0)),
    )
  )
    ctx.addIssue({
      code: "custom",
      path: ["totalProjectCost"],
      message: "Total project cost must include initial investment",
    });
  const p = s.otherPotentialAnnualIncome.value,
    i = s.otherEffectiveAnnualIncome.value;
  if (p !== null && i !== null && new Decimal(i).gt(p))
    ctx.addIssue({
      code: "custom",
      path: ["otherEffectiveAnnualIncome"],
      message: "Effective income exceeds potential",
    });
  if (
    s.operatingExpenses.mode === "total" &&
    s.operatingExpenses.annualAmount?.value !== null &&
    !s.operatingExpenses.annualAmount?.note
  )
    ctx.addIssue({
      code: "custom",
      path: ["operatingExpenses"],
      message: "Describe included owner-paid costs",
    });
  if (s.operatingExpenses.mode === "itemized") {
    const items = s.operatingExpenses.items!;
    if (
      new Set(items.map((i) => i.id)).size !== items.length ||
      new Set(items.map((i) => i.category + ":" + i.label.trim().toLowerCase()))
        .size !== items.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["operatingExpenses"],
        message: "Duplicate expense",
      });
    if (items.length && new Set(items.map((i) => i.category)).size !== 6)
      ctx.addIssue({
        code: "custom",
        path: ["operatingExpenses"],
        message: "All six expense categories must be disclosed",
      });
  }
}
export const Scenario = z
  .strictObject(responseScenarioShape())
  .superRefine(validateScenario);
export const ScenarioInput = z
  .strictObject(requestScenarioShape())
  .superRefine(validateScenario);
export const Constraints = z.strictObject({
  maxInitialInvestment: datum(Amount, "USD"),
  maxPaybackYears: datum(Positive, "years"),
  minimumYieldOnCost: datum(Ratio, "ratio"),
  riskTolerance: z.enum(["low", "moderate", "high"]),
  objective: z.literal("maximize_incremental_noi"),
});
export const ConstraintsInput = z.strictObject({
  maxInitialInvestment: inputValue(Amount, "USD"),
  maxPaybackYears: inputValue(Positive, "years"),
  minimumYieldOnCost: inputValue(Ratio, "ratio"),
  riskTolerance: z.enum(["low", "moderate", "high"]),
  objective: z.literal("maximize_incremental_noi"),
});
export const ComparisonRequestBase = z.strictObject({
  contractVersion: z.literal("1"),
  propertyId: Id,
  inputRevision: z.number().int().nonnegative(),
  scenarios: z.array(ScenarioInput).min(1).max(6),
  constraints: ConstraintsInput,
});
export function validateSet(
  s: z.infer<typeof ComparisonRequestBase>,
  ctx: z.RefinementCtx,
  complete: boolean,
) {
  if (
    s.scenarios.filter((v) => v.role === "baseline").length !== 1 ||
    (complete && s.scenarios.length < 3)
  )
    ctx.addIssue({
      code: "custom",
      path: ["scenarios"],
      message:
        "Exactly one baseline and at least two alternatives required for comparison",
    });
  if (new Set(s.scenarios.map((v) => v.id)).size !== s.scenarios.length)
    ctx.addIssue({
      code: "custom",
      path: ["scenarios"],
      message: "Duplicate scenario IDs",
    });
  if (
    s.scenarios.some(
      (v) =>
        v.propertyId !== s.propertyId ||
        v.period.start !== s.scenarios[0].period.start ||
        v.period.end !== s.scenarios[0].period.end,
    )
  )
    ctx.addIssue({
      code: "custom",
      path: ["scenarios"],
      message: "Property and period must match",
    });
}
export const ComparisonRequest = ComparisonRequestBase.superRefine((s, ctx) =>
  validateSet(s, ctx, true),
);
export const AnalysisRequest = ComparisonRequestBase.extend({
  action: z.enum([
    "analyze",
    "suggest_uses",
    "compare",
    "risks",
    "explain",
    "summary",
  ]),
  question: Text.optional(),
}).superRefine((s, ctx) => {
  const initial = s.action === "analyze" || s.action === "suggest_uses";
  validateSet(s, ctx, !initial);
  if (initial && s.scenarios.length > 3)
    ctx.addIssue({
      code: "custom",
      path: ["scenarios"],
      message: "Initial analysis permits at most three scenarios",
    });
});
