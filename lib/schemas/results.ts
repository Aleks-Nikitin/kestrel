import { z } from "zod";
import {
  Id,
  Text,
  Unit,
  Instant,
  FinancialDecimal,
  Evidence,
} from "./primitives";
import { Scenario } from "./scenarios";
import { Property, SpatialContext, validateEvidence } from "./property";
export const Metric = z
  .strictObject({
    value: FinancialDecimal.nullable(),
    unit: Unit,
    origin: z.literal("derived_calculation"),
    formulaId: z.string().regex(/^finance\.v1\.[A-Za-z]+$/),
    inputPaths: z.array(Text).min(1),
    unavailableReason: Text.nullable(),
  })
  .refine(
    (m) =>
      m.value === null ? !!m.unavailableReason : m.unavailableReason === null,
    "Unavailable metric requires reason",
  );
const metric = (unit: z.infer<typeof Unit>) =>
  Metric.safeExtend({ unit: z.literal(unit) });
export const FinancialResult = z.strictObject({
  scenarioId: Id,
  currency: z.literal("USD"),
  period: Scenario.shape.period,
  calculationVersion: z.literal("1"),
  potentialRent: metric("USD/year"),
  potentialGrossIncome: metric("USD/year"),
  vacancyLoss: metric("USD/year"),
  collectionLoss: metric("USD/year"),
  concessions: metric("USD/year"),
  otherIncomeLoss: metric("USD/year"),
  effectiveGrossIncome: metric("USD/year"),
  operatingExpenses: metric("USD/year"),
  noi: metric("USD/year"),
  initialInvestment: metric("USD"),
  incrementalNoi: metric("USD/year"),
  paybackYears: metric("years"),
  yieldOnCost: metric("ratio"),
  warnings: z.array(Text),
});
export const Feasibility = z.strictObject({
  scenarioId: Id,
  checks: z.array(
    z.strictObject({
      dimension: z.enum(["legal", "physical", "financial", "risk"]),
      status: z.enum(["supported", "excluded", "unverified"]),
      code: Id,
      explanation: Text,
      evidenceIds: z.array(Id),
    }),
  ),
  eligibility: z.enum([
    "eligible",
    "conditional",
    "excluded",
    "insufficient_data",
  ]),
  productivity: z.strictObject({
    status: z.literal("not_established"),
    explanation: Text,
  }),
});
export const Comparison = z.strictObject({
  policyVersion: z.literal("1"),
  inputRevision: z.number().int().nonnegative(),
  results: z.array(FinancialResult).min(3).max(6),
  feasibility: z.array(Feasibility).min(3).max(6),
  rankedScenarioIds: z.array(Id),
  preferredScenarioId: Id.nullable(),
  conclusion: z.enum([
    "conditional_preference",
    "retain_baseline",
    "insufficient_evidence",
  ]),
  reasons: z.array(
    z.strictObject({
      code: Id,
      scenarioIds: z.array(Id),
      evidenceIds: z.array(Id),
      text: Text,
    }),
  ),
  missingInputs: z.array(Text),
});
export const InvestmentSummary = z.strictObject({
  preferredScenarioId: Id.nullable(),
  headline: Text,
  claims: z.array(
    z.strictObject({
      text: Text,
      evidenceIds: z.array(Id),
      metricRefs: z.array(z.string().regex(/^[A-Za-z0-9_.:-]+\.[A-Za-z]+$/)),
      kind: z.enum(["fact", "assumption", "inference"]),
    }),
  ),
  limitations: z.array(Text),
  nextSteps: z.array(Text),
  generatedAt: Instant,
});
const ResponseShape = {
  contractVersion: z.literal("1"),
  propertyId: Id,
  inputRevision: z.number().int().nonnegative(),
  scenarios: z.array(Scenario).min(1).max(6),
  evidence: z.array(Evidence).max(500),
};
type ResponseSet = {
  propertyId: string;
  inputRevision: number;
  scenarios: z.infer<typeof Scenario>[];
  evidence: z.infer<typeof Evidence>[];
  comparison?: z.infer<typeof Comparison>;
};
function validateResponse(s: ResponseSet, ctx: z.RefinementCtx) {
  const ids = new Set(s.scenarios.map((v) => v.id));
  const refs = s.scenarios.flatMap((v) =>
    [
      v.rentableAreaSqft,
      v.annualRentPerSqft,
      v.occupancyRatio,
      v.collectionLossRatio,
      v.annualConcessions,
      v.otherPotentialAnnualIncome,
      v.otherEffectiveAnnualIncome,
      v.totalProjectCost,
      ...Object.values(v.capex),
      ...(v.operatingExpenses.mode === "total"
        ? [v.operatingExpenses.annualAmount]
        : v.operatingExpenses.items.map((i) => i.annualAmount)),
    ].flatMap((d) => d.evidenceIds),
  );
  validateEvidence(s.propertyId, s.evidence, refs, ctx);
  if (
    ids.size !== s.scenarios.length ||
    s.scenarios.some(
      (v) =>
        v.propertyId !== s.propertyId ||
        v.period.start !== s.scenarios[0].period.start ||
        v.period.end !== s.scenarios[0].period.end,
    ) ||
    s.scenarios.filter((v) => v.role === "baseline").length !== 1
  )
    ctx.addIssue({
      code: "custom",
      message: "Scenario identity, baseline and period must agree",
    });
  if (!s.comparison) return;
  const c = s.comparison;
  const resultIds = c.results.map((r) => r.scenarioId),
    feasibilityIds = c.feasibility.map((f) => f.scenarioId);
  if (
    s.scenarios.length < 3 ||
    c.inputRevision !== s.inputRevision ||
    resultIds.length !== ids.size ||
    new Set(resultIds).size !== ids.size ||
    feasibilityIds.length !== ids.size ||
    new Set(feasibilityIds).size !== ids.size ||
    [
      ...resultIds,
      ...feasibilityIds,
      ...c.rankedScenarioIds,
      ...(c.preferredScenarioId ? [c.preferredScenarioId] : []),
      ...c.reasons.flatMap((r) => r.scenarioIds),
    ].some((id) => !ids.has(id)) ||
    new Set(c.rankedScenarioIds).size !== c.rankedScenarioIds.length
  )
    ctx.addIssue({
      code: "custom",
      message: "Comparison references or revision do not resolve",
    });
  if (
    (c.conclusion === "insufficient_evidence") !==
    (c.preferredScenarioId === null)
  )
    ctx.addIssue({
      code: "custom",
      message: "Conclusion and preferred scenario disagree",
    });
  const preferred = s.scenarios.find((v) => v.id === c.preferredScenarioId);
  if (
    preferred &&
    (c.conclusion === "retain_baseline") !== (preferred.role === "baseline")
  )
    ctx.addIssue({
      code: "custom",
      message: "Preferred scenario role disagrees with conclusion",
    });
  validateEvidence(
    s.propertyId,
    s.evidence,
    [
      ...c.reasons.flatMap((r) => r.evidenceIds),
      ...c.feasibility.flatMap((f) => f.checks.flatMap((v) => v.evidenceIds)),
    ],
    ctx,
  );
}
export const ComparisonResponse = z
  .strictObject({ ...ResponseShape, comparison: Comparison })
  .superRefine(validateResponse);
export const ModelUsage = z.strictObject({
  provider: z.enum(["gemini", "openrouter"]),
  modelId: Text.min(1),
  fallbackUsed: z.boolean(),
  attempts: z.number().int().min(1).max(8),
});
const AnalysisShape = {
  contractVersion: z.literal("1"),
  property: Property,
  spatial: SpatialContext,
  scenarios: ResponseShape.scenarios,
  inputRevision: ResponseShape.inputRevision,
  evidence: ResponseShape.evidence,
};
export const AnalysisComplete = z.strictObject({
  ...AnalysisShape,
  status: z.literal("complete"),
  comparison: Comparison,
  summary: InvestmentSummary,
  modelUsage: ModelUsage,
  execution: z.strictObject({
    requestId: Id,
    completedTools: z
      .array(
        z.strictObject({ toolCallId: Id, name: Id, evidenceIds: z.array(Id) }),
      )
      .min(1)
      .max(16),
    modelId: Text.min(1),
    elapsedMs: z.number().int().nonnegative().max(60000),
    dataMode: z.enum([
      "live",
      "mixed",
      "licensed_cache",
      "sponsor_dataset",
      "synthetic",
    ]),
    sources: z.strictObject({
      propertyMode: Property.shape.dataMode,
      spatialMode: SpatialContext.shape.dataMode,
    }),
    verification: z.strictObject({
      status: z.literal("verified"),
      method: z.literal("bound_claims_v1"),
      submissionAttempts: z.number().int().min(1).max(2),
      correctionAttempts: z.number().int().min(0).max(1),
    }).refine(v => v.correctionAttempts === v.submissionAttempts - 1, "Verification attempts must agree").optional(),
  }),
});
export const AnalysisNeedsInput = z.strictObject({
  ...AnalysisShape,
  status: z.literal("needs_input"),
  missingInputs: z
    .array(z.strictObject({ path: Text.min(1), reason: Text.min(1) }))
    .min(1),
});
export const AnalysisResponse = z
  .discriminatedUnion("status", [AnalysisComplete, AnalysisNeedsInput])
  .superRefine((s, ctx) => {
    validateResponse(
      {
        ...s,
        propertyId: s.property.id,
        comparison: s.status === "complete" ? s.comparison : undefined,
      },
      ctx,
    );
    if (s.spatial.propertyId !== s.property.id)
      ctx.addIssue({ code: "custom", message: "Spatial property mismatch" });
    if (s.status !== "complete") return;
    if (s.execution.verification && !s.execution.completedTools.some(t => t.name === "verifyAnalysis"))
      ctx.addIssue({code:"custom",message:"Verification requires a completed verifier tool result"});
    const refs = new Set(
      s.comparison.results.flatMap((r) =>
        Object.keys(FinancialResult.shape)
          .filter((k) =>
            [
              "potentialRent",
              "potentialGrossIncome",
              "vacancyLoss",
              "collectionLoss",
              "concessions",
              "otherIncomeLoss",
              "effectiveGrossIncome",
              "operatingExpenses",
              "noi",
              "initialInvestment",
              "incrementalNoi",
              "paybackYears",
              "yieldOnCost",
            ].includes(k),
          )
          .map((k) => `${r.scenarioId}.${k}`),
      ),
    );
    if (
      s.summary.preferredScenarioId !== s.comparison.preferredScenarioId ||
      s.summary.claims.some((c) => c.metricRefs.some((r) => !refs.has(r)))
    )
      ctx.addIssue({
        code: "custom",
        message: "Summary references must resolve to canonical comparison",
      });
    validateEvidence(
      s.property.id,
      s.evidence,
      [
        ...s.summary.claims.flatMap((c) => c.evidenceIds),
        ...s.execution.completedTools.flatMap((t) => t.evidenceIds),
      ],
      ctx,
    );
    if (
      s.execution.modelId !== s.modelUsage.modelId ||
      s.execution.sources.propertyMode !== s.property.dataMode ||
      s.execution.sources.spatialMode !== s.spatial.dataMode
    )
      ctx.addIssue({
        code: "custom",
        message: "Execution metadata does not match returned sources/model",
      });
    if (s.modelUsage.fallbackUsed !== (s.modelUsage.provider === "openrouter")) ctx.addIssue({ code: "custom", message: "Fallback metadata must identify the provider actually used" });
  const expected =
      s.property.dataMode === "synthetic" && s.spatial.dataMode === "synthetic"
        ? "synthetic"
        : s.property.dataMode === s.spatial.dataMode
          ? s.property.dataMode
          : "mixed";
    if (s.execution.dataMode !== expected)
      ctx.addIssue({
        code: "custom",
        message: "Overall data mode must reflect both layers",
      });
  });
export const ApiError = z.strictObject({
  code: z.enum([
    "INVALID_INPUT",
    "NOT_FOUND",
    "UPSTREAM_AUTH",
    "UPSTREAM_UNAVAILABLE",
    "RATE_LIMITED",
    "TIMEOUT",
    "DATA_MISMATCH",
    "LICENSE_RESTRICTED",
    "INSUFFICIENT_DATA",
    "CONTRACT_MISMATCH",
    "INTERNAL",
    "ANALYSIS_UNAVAILABLE",
  ]),
  message: Text,
  retryable: z.boolean(),
  requestId: Id,
  fieldErrors: z
    .array(z.strictObject({ path: Text, message: Text }))
    .optional(),
});
export function apiResponse<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data, requestId: Id }),
    z.strictObject({ ok: z.literal(false), error: ApiError }),
  ]);
}
