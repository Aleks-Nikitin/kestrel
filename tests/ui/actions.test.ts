import { describe, expect, it } from "vitest";
import { ComparisonRequest } from "@/lib/contracts";
import { property, propertyId } from "../fixtures/contracts";
import { ACTIONS, actionBlock, buildAnalysisRequest } from "@/features/analysis/actions";
import { initialModel, validateModel } from "@/features/scenarios/model";
import { initialState, reducer } from "@/features/dashboard/state";

function request() {
  const m = initialModel(property, 2026);
  m.scenarios = m.scenarios.map((s) => ({ ...s, proposedUse: s.proposedUse || "Storage" }));
  m.scenarios[1].annualRentPerSqft = { text: "12.50", accepted: false };
  const v = validateModel(m, propertyId, 4);
  if (!v.request) throw new Error("fixture must validate");
  return v.request;
}

describe("buildAnalysisRequest", () => {
  it("adds only the action and trimmed question; scenarios pass through byte for byte", () => {
    const r = request();
    const a = buildAnalysisRequest(r, "explain", "  why? ");
    expect(a.action).toBe("explain");
    expect(a.question).toBe("why?");
    expect(a.scenarios).toEqual(r.scenarios);
    expect(a.scenarios[1].annualRentPerSqft).toEqual({ value: "12.50" });
    expect(a.inputRevision).toBe(4);
    expect(a.propertyId).toBe(propertyId);
  });
  it("omits an empty question", () => {
    expect("question" in buildAnalysisRequest(request(), "risks", "   ")).toBe(false);
  });
});

describe("actionBlock", () => {
  it("allows every action for valid inputs with three scenarios", () => {
    for (const a of ACTIONS) expect(actionBlock(request(), 0, a.id, "")).toBeNull();
  });
  it("blocks all actions while the editor has problems", () => {
    expect(actionBlock(null, 2, "analyze", "")).toMatch(/Fix 2 problems/);
    expect(actionBlock(null, 1, "summary", "")).toMatch(/Fix 1 problem /);
  });
  it("blocks over-long questions", () => {
    expect(actionBlock(request(), 0, "explain", "x".repeat(2001))).toMatch(/under 2000/);
  });
  it("blocks initial analysis above three scenarios but leaves compare available", () => {
    const base = request();
    const extra = { ...base.scenarios[2], id: "alternative-c", name: "Alternative C" };
    const four = ComparisonRequest.parse({ ...base, scenarios: [...base.scenarios, extra] });
    expect(actionBlock(four, 0, "analyze", "")).toMatch(/at most three/);
    expect(actionBlock(four, 0, "compare", "")).toBeNull();
  });
});

describe("analysisAction state", () => {
  it("records the running action and clears it on property change", () => {
    let s = reducer(initialState, { type: "select", propertyId: propertyId });
    s = reducer(s, { type: "analysis_started", action: "risks" });
    expect(s.analysisAction).toBe("risks");
    expect(s.analysis.status).toBe("loading");
    s = reducer(s, { type: "analysis_cancelled" });
    expect(s.analysisAction).toBeNull();
    s = reducer(s, { type: "analysis_started", action: "summary" });
    s = reducer(s, { type: "select", propertyId: "other" });
    expect(s.analysisAction).toBeNull();
    expect(s.analysis.status).toBe("idle");
  });
});
