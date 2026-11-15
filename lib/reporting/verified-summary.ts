import "server-only";
import { InvestmentSummary } from "@/lib/contracts";
import type { AnalysisSubmissionDTO, VerificationContext } from "@/lib/agent/verification";
import { buildInvestmentSummary } from "./summary";
/** Model-selected focus is rendered from held values, never from model prose. */
export function buildVerifiedSummary(context: VerificationContext, selected: AnalysisSubmissionDTO) {
    const base = buildInvestmentSummary({ ...context, response: context.comparison });
    const focus: typeof base.claims = [];
    for (const c of selected.financialClaims) {
        const result = context.comparison.comparison.results.find(r => r.scenarioId === c.scenarioId)!;
        const metric = result[c.metric], ref = `${c.scenarioId}.${c.metric}`;
        const name = context.comparison.scenarios.find(s => s.id === c.scenarioId)!.name;
        focus.push({ text: `Agent-selected financial focus, checked against the deterministic tool: ${name}, ${c.metric} = ${metric.value ?? "unavailable"} ${metric.unit}.`, metricRefs: [ref], evidenceIds: base.claims.find(claim => claim.metricRefs.includes(ref))?.evidenceIds ?? [], kind: "inference" });
    }
    for (const c of selected.propertyClaims) {
        const datum = context.property[c.field];
        focus.push({ text: `Agent-selected property context: recorded rentable area is ${datum.value ?? "unknown"} sqft.`, metricRefs: [], evidenceIds: datum.evidenceIds, kind: datum.origin === "source_data" ? "fact" : "assumption" });
    }
    for (const c of selected.spatialClaims) {
        const room = context.spatial.model!.rooms.find(r => r.id === c.roomId)!;
        focus.push({ text: `Agent-selected spatial context: room ${room.id}, ${c.dimension} = ${room[c.dimension] ?? "unknown"} ${c.dimension === "floorArea" ? "m2" : "m"}. Model dimensions are estimates and do not certify scan coverage or structural suitability.`, metricRefs: [], evidenceIds: c.evidenceIds, kind: "inference" });
    }
    for (const code of selected.riskCodes) {
        const finding = context.comparison.comparison.feasibility.flatMap(f => f.checks).find(c => c.code === code)!;
        focus.push({ text: `Agent-selected policy finding: ${finding.explanation}`, metricRefs: [], evidenceIds: finding.evidenceIds, kind: "inference" });
    }
    return InvestmentSummary.parse({ ...base, claims: [...base.claims, ...focus], limitations: ["Verification checks bound claims against retrieved records and the existing policy; it does not establish market accuracy, legal permission or structural safety.", ...new Set(base.limitations)].slice(0, 30) });
}
