import "server-only";
import { z } from "zod";
import Decimal from "decimal.js";
import { isToolMessage } from "@langchain/core/messages";
import { isCommand } from "@langchain/langgraph";
import { Id, FinancialDecimal, Unit, Property, SpatialContext, type PropertyDTO, type SpatialContextDTO, type ComparisonResponseDTO, type ComparisonRequestDTO } from "@/lib/contracts";
import { normalizeConstraintsInputs } from "@/lib/contracts/normalize";
import { compareScenarios } from "@/lib/feasibility/compare";
export const MetricName = z.enum(["potentialRent", "potentialGrossIncome", "vacancyLoss", "collectionLoss", "concessions", "otherIncomeLoss", "effectiveGrossIncome", "operatingExpenses", "noi", "initialInvestment", "incrementalNoi", "paybackYears", "yieldOnCost"]);
/** Claims bind to existing DTO fields, never to a new free-text metric language. */
export const AnalysisSubmission = z.strictObject({
    propertyId: Id,
    inputRevision: z.number().int().nonnegative(),
    preferredScenarioId: Id.nullable(),
    financialClaims: z.array(z.strictObject({ scenarioId: Id, metric: MetricName, value: FinancialDecimal.nullable(), unit: Unit })).min(1).max(6),
    propertyClaims: z.array(z.strictObject({ field: z.enum(["rentableAreaSqft"]), value: FinancialDecimal.nullable(), unit: z.enum(["sqft"]), evidenceIds: z.array(Id).min(1).max(10) })).max(2),
    spatialClaims: z.array(z.strictObject({ roomId: Id, dimension: z.enum(["width", "depth", "height", "floorArea"]), value: FinancialDecimal.nullable(), unit: z.enum(["m", "m2"]), evidenceIds: z.array(Id).min(1).max(10) })).max(3),
    riskCodes: z.array(Id).max(3),
});
export type AnalysisSubmissionDTO = z.infer<typeof AnalysisSubmission>;
export type VerificationIssue = {
    code: string;
    path: string;
    correctable: boolean;
};
export interface VerificationContext {
    property: PropertyDTO;
    spatial: SpatialContextDTO;
    request: ComparisonRequestDTO;
    comparison: ComparisonResponseDTO;
}
export function contextIssue(property: PropertyDTO, spatial: SpatialContextDTO): VerificationIssue | null {
    if (!Property.safeParse(property).success || !SpatialContext.safeParse(spatial).success || spatial.propertyId !== property.id)
        return { code: "CONTEXT_IDENTITY_INVALID", path: "context", correctable: false };
    if ([...property.evidence, ...spatial.evidence].some(e => !e.allowedUse.display))
        return { code: "EVIDENCE_NOT_AUTHORIZED", path: "context.evidence", correctable: false };
    if (spatial.model && (spatial.match.status !== "verified" || spatial.provider !== "matterport" || spatial.model.joinSource !== "costar_property_id" || spatial.model.commercialPropertyId !== property.id))
        return { code: "MODEL_IDENTITY_INVALID", path: "spatial.model", correctable: false };
    if (spatial.model && spatial.evidence.some(e => e.provider === "matterport" && e.recordId !== spatial.model!.id))
        return { code: "MODEL_EVIDENCE_MISMATCH", path: "spatial.evidence", correctable: false };
    return null;
}
export function successfulToolResult(result: unknown, callId: string, name: string): boolean {
    let messages: unknown[] = [];
    if (isToolMessage(result))
        messages = [result];
    else if (isCommand(result)) {
        const update = Array.isArray(result.update) ? Object.fromEntries(result.update) : result.update;
        if (Array.isArray(update?.messages))
            messages = update.messages;
    }
    return messages.some(m => isToolMessage(m) && m.status !== "error" && m.tool_call_id === callId && m.name === name);
}
function sameNumber(a: string | null, b: string | null) { return a === null || b === null ? a === b : new Decimal(a).eq(b); }
export function verifyAnalysisSubmission(raw: unknown, context: VerificationContext): {
    valid: boolean;
    issues: VerificationIssue[];
    submission?: AnalysisSubmissionDTO;
} {
    const issues: VerificationIssue[] = [];
    const fail = (code: string, path: string, correctable = true) => { issues.push({ code, path, correctable }); };
    const identity = contextIssue(context.property, context.spatial);
    if (identity)
        return { valid: false, issues: [identity] };
    const parsed = AnalysisSubmission.safeParse(raw);
    if (!parsed.success)
        return { valid: false, issues: [{ code: "SUBMISSION_SHAPE_INVALID", path: "submission", correctable: true }] };
    const s = parsed.data, { property, spatial, request, comparison } = context;
    if (s.propertyId !== property.id || s.inputRevision !== request.inputRevision || comparison.propertyId !== property.id || comparison.inputRevision !== request.inputRevision)
        fail("REQUEST_IDENTITY_MISMATCH", "submission", false);
    const evidence = [...property.evidence, ...spatial.evidence, ...comparison.evidence];
    const citations = (ids: string[], allowed: string[], path: string) => {
        for (const id of ids) {
            const found = evidence.filter(e => e.id === id);
            if (!found.length || !allowed.includes(id))
                fail("EVIDENCE_NOT_SUPPORTED", path);
            else if (found.some(e => e.propertyId !== property.id || !e.allowedUse.display))
                fail("EVIDENCE_NOT_AUTHORIZED", path, false);
        }
    };
    // Reuse the existing policy and held tool results; no financial formula is reimplemented.
    try {
        const constraints = normalizeConstraintsInputs(property.id, request.constraints, { inputRevision: request.inputRevision }).constraints;
        const policy = compareScenarios(comparison.scenarios, comparison.comparison.results, constraints, property, request.inputRevision);
        if (policy.preferredScenarioId !== comparison.comparison.preferredScenarioId || policy.conclusion !== comparison.comparison.conclusion || JSON.stringify(policy.rankedScenarioIds) !== JSON.stringify(comparison.comparison.rankedScenarioIds) || policy.feasibility.some(f => comparison.comparison.feasibility.find(c => c.scenarioId === f.scenarioId)?.eligibility !== f.eligibility))
            fail("CANONICAL_POLICY_MISMATCH", "comparison", false);
        if (s.preferredScenarioId !== policy.preferredScenarioId)
            fail("RECOMMENDATION_MISMATCH", "preferredScenarioId");
    }
    catch {
        fail("CANONICAL_POLICY_INVALID", "comparison", false);
    }
    s.financialClaims.forEach((c, i) => {
        const metric = comparison.comparison.results.find(r => r.scenarioId === c.scenarioId)?.[c.metric];
        if (!metric)
            fail("METRIC_NOT_FOUND", `financialClaims.${i}`);
        else if (metric.unit !== c.unit || !sameNumber(metric.value, c.value))
            fail("FINANCIAL_CLAIM_MISMATCH", `financialClaims.${i}`);
    });
    s.propertyClaims.forEach((c, i) => {
        const datum = property[c.field];
        citations(c.evidenceIds, datum.evidenceIds, `propertyClaims.${i}.evidenceIds`);
        if (!sameNumber(datum.value, c.value))
            fail("PROPERTY_CLAIM_MISMATCH", `propertyClaims.${i}.value`);
    });
    s.spatialClaims.forEach((c, i) => {
        const room = spatial.model?.rooms.find(r => r.id === c.roomId);
        const path = `spatialClaims.${i}`;
        if (spatial.match.status !== "verified" || !room) {
            fail("SPATIAL_CLAIM_NOT_SUPPORTED", path);
            return;
        }
        citations(c.evidenceIds, spatial.evidence.map(e => e.id), `${path}.evidenceIds`);
        if (c.unit !== (c.dimension === "floorArea" ? "m2" : "m"))
            fail("SPATIAL_UNIT_MISMATCH", `${path}.unit`);
        if (room[c.dimension] === null && c.value !== null)
            fail("UNKNOWN_MEASUREMENT", `${path}.value`);
        else if (!sameNumber(room[c.dimension], c.value))
            fail("SPATIAL_VALUE_MISMATCH", `${path}.value`);
    });
    const knownRisk = new Set(comparison.comparison.feasibility.flatMap(f => f.checks.map(c => c.code)));
    s.riskCodes.forEach((code, i) => { if (!knownRisk.has(code))
        fail("POLICY_FINDING_NOT_FOUND", `riskCodes.${i}`); });
    return { valid: issues.length === 0, issues: issues.slice(0, 20), ...(issues.length === 0 ? { submission: s } : {}) };
}
