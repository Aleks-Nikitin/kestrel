import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FakeToolCallingModel, type StructuredTool } from "langchain";
import { f01, property, spatial } from "../fixtures/contracts";
import { createComparisonService } from "@/lib/contracts/service";
import { runPropertyAnalysis } from "@/lib/agent/analysis";
import { readAgentConfig } from "@/lib/agent/config";
import { failure } from "@/lib/api/http";
import type { AnalysisSubmissionDTO } from "@/lib/agent/verification";
import type { ComparisonRequestDTO } from "@/lib/contracts";
const config = readAgentConfig({ ANALYSIS_ENABLED: "true" });
const service = () => createComparisonService({ property: { async listProperties() { return [property]; }, async getProperty() { return property; } }, spatial: { async getSpatialContext() { return spatial; } } });
const draft = (input = f01, preferred = "alternative-b"): AnalysisSubmissionDTO => ({ propertyId: input.propertyId, inputRevision: input.inputRevision, preferredScenarioId: preferred, financialClaims: [{ scenarioId: "alternative-b", metric: "noi", value: "195000", unit: "USD/year" }], propertyClaims: [], spatialClaims: [], riskCodes: [] });
type Call = {
    name: string;
    args: Record<string, unknown>;
    id: string;
};
function script(input: ComparisonRequestDTO, submissions: unknown[]): Call[][] {
    return [
        [{ name: "write_todos", args: { todos: [{ content: "Review, compare and verify", status: "in_progress" }] }, id: "plan" }],
        [{ name: "getPropertyContext", args: { propertyId: input.propertyId }, id: "context" }],
        [{ name: "proposeScenarios", args: { scenarioIds: input.scenarios.map(s => s.id) }, id: "candidates" }],
        [{ name: "runComparison", args: { propertyId: input.propertyId, inputRevision: input.inputRevision }, id: "compare" }],
        ...submissions.map((args, i) => [{ name: "verifyAnalysis", args: args as Record<string, unknown>, id: `submission-${i + 1}` }]),
        [{ name: "write_todos", args: { todos: [{ content: "Review, compare and verify", status: "completed" }] }, id: "done" }], [],
    ];
}
class RecordingModel extends FakeToolCallingModel {
    calls = 0;
    messages: string[] = [];
    override bindTools(tools: StructuredTool[]) { void tools; return this; }
    override async _generate(...args: Parameters<FakeToolCallingModel["_generate"]>) { this.calls++; this.messages.push(JSON.stringify(args[0])); return super._generate(...args); }
}
async function run(submissions: unknown[], input = structuredClone(f01)) {
    const comparisonService = service();
    const spy = vi.spyOn(comparisonService, "compare");
    const primary = new RecordingModel({ toolCalls: script(input, submissions) });
    const pending = runPropertyAnalysis({ request: { ...input, action: "analyze" }, config, service: comparisonService, models: { primary }, signal: AbortSignal.timeout(10000) });
    return { pending, primary, spy, comparisonService };
}
describe("one native bounded corrective submission", () => {
    it("corrects an unsupported financial claim once, reusing the actual comparison", async () => {
        const bad = draft();
        bad.financialClaims[0].value = "999999";
        const r = await run([bad, draft()]);
        const result = await r.pending;
        expect(result.status).toBe("complete");
        if (result.status !== "complete")
            throw Error("Expected verified output");
        expect(result.execution.verification).toEqual({ status: "verified", method: "bound_claims_v1", submissionAttempts: 2, correctionAttempts: 1 });
        expect(r.primary.calls).toBe(8);
        expect(r.spy).toHaveBeenCalledOnce();
        expect(result.execution.completedTools.filter(t => t.name === "verifyAnalysis").map(t => t.toolCallId)).toEqual(["submission-2"]);
        expect(JSON.stringify(result.summary)).not.toContain("999999");
        expect(r.primary.messages.join("\n")).toContain("FINANCIAL_CLAIM_MISMATCH");
    });
    it("rejects a correction that still fails, stops before a third submission, and keeps comparison healthy", async () => {
        const bad = draft();
        bad.financialClaims[0].value = "999999";
        const stillBad = draft();
        stillBad.financialClaims[0].value = "888888";
        const r = await run([bad, stillBad, draft()]);
        const error = await r.pending.then(() => null, e => e);
        expect(error?.code).toBe("ANALYSIS_UNAVAILABLE");
        expect(r.primary.calls).toBeLessThanOrEqual(6);
        expect(r.spy).toHaveBeenCalledOnce();
        const http = failure(error);
        expect(http.status).toBe(503);
        expect((await http.json()).error.retryable).toBe(false);
        const direct = await r.comparisonService.compare(f01, AbortSignal.timeout(1000));
        expect(direct.comparison.preferredScenarioId).toBe("alternative-b");
    });
    it("counts malformed output against the same single corrective attempt", async () => {
        const r = await run([{ unrecognized: "unsupported explanation" }, draft()]);
        const result = await r.pending;
        expect(result.status).toBe("complete");
        if (result.status === "complete")
            expect(result.execution.verification?.correctionAttempts).toBe(1);
        expect(r.primary.calls).toBe(8);
    });
    it("keeps an unknown room height unknown after one corrective submission", async () => {
        const original = spatial.model!.rooms[0].height;
        spatial.model!.rooms[0].height = null;
        try {
            const bad = draft();
            bad.spatialClaims = [{ roomId: "room-001", dimension: "height", value: "3", unit: "m", evidenceIds: ["synthetic-assumption"] }];
            const corrected = structuredClone(bad);
            corrected.spatialClaims[0].value = null;
            const r = await run([bad, corrected]);
            const result = await r.pending;
            expect(result.status).toBe("complete");
            if (result.status !== "complete") throw Error("Expected verified output");
            expect(result.execution.verification?.correctionAttempts).toBe(1);
            expect(result.summary.claims.some(c => c.text.includes("height = unknown m"))).toBe(true);
            expect(result.spatial.model!.rooms[0].height).toBeNull();
            expect(r.primary.calls).toBe(8);
        } finally { spatial.model!.rooms[0].height = original; }
    });
    it("does not repair an output property-identity failure", async () => {
        const bad = draft();
        bad.propertyId = "different-property";
        const r = await run([bad, draft()]);
        await expect(r.pending).rejects.toMatchObject({ code: "ANALYSIS_UNAVAILABLE" });
        expect(r.primary.calls).toBeLessThanOrEqual(5);
    });
    it("re-evaluates an explicit budget change with fresh policy and a new verified explanation", async () => {
        const first = await run([draft()]);
        const a = await first.pending;
        const changed = structuredClone(f01);
        changed.inputRevision++;
        changed.constraints.maxInitialInvestment.value = "350000";
        const second = await run([draft(changed, "alternative-a")], changed);
        const b = await second.pending;
        expect(a.status).toBe("complete");
        expect(b.status).toBe("complete");
        if (a.status !== "complete" || b.status !== "complete")
            throw Error("Expected complete what-if pair");
        expect(a.comparison.preferredScenarioId).toBe("alternative-b");
        expect(b.comparison.preferredScenarioId).toBe("alternative-a");
        expect(b.comparison.feasibility.find(f => f.scenarioId === "alternative-b")?.eligibility).toBe("excluded");
        expect(b.summary.preferredScenarioId).toBe("alternative-a");
        expect(b.execution.requestId).not.toBe(a.execution.requestId);
        expect(b.inputRevision).toBe(changed.inputRevision);
    });
});
