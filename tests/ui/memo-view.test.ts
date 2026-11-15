import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysisResult } from "@/features/analysis/analysis-result";
import { ACTION_FOCUS, activityLabel, buildMemoView, friendlyUnavailable, missingInputLabel } from "@/features/analysis/memo-view";
import { analysis, needsInput } from "../fixtures/contracts";

function complete() {
  if (analysis.status !== "complete") throw new Error("fixture");
  return structuredClone(analysis);
}
const html = (r = complete(), stale = false, action: Parameters<typeof buildMemoView>[1] = "analyze") =>
  renderToStaticMarkup(createElement(AnalysisResult, { response: r, stale, action }));

describe("memo view adapter", () => {
  it("is pure: the response is not mutated and repeated calls agree", () => {
    const r = complete();
    const before = JSON.stringify(r);
    const a = buildMemoView(r, "analyze");
    const b = buildMemoView(r, "analyze");
    expect(JSON.stringify(r)).toBe(before);
    expect(a).toEqual(b);
    a.findings[0]?.scenarios.push("mutated");
    a.focus.order.push("ranking");
    expect(buildMemoView(r, "analyze")).toEqual(b);
    expect(ACTION_FOCUS.analyze.order).not.toContain("ranking");
  });

  it.each(["analyze", "compare", "risks", "explain", "summary"] as const)("%s uses the same payload and only changes the order", (action) => {
    const v = buildMemoView(complete(), action);
    const base = buildMemoView(complete(), "analyze");
    expect({ ...v, focus: null }).toEqual({ ...base, focus: null });
    expect(v.focus.action).toBe(action);
    expect(new Set(v.focus.order).size).toBe(v.focus.order.length);
    expect(v.decision.preferred?.name).toBe("alternative-b");
  });

  it("rounds for reading and keeps the server's exact strings for the audit", () => {
    const r = complete();
    r.comparison.results[2].noi.value = "195000.12345678";
    const v = buildMemoView(r, "analyze");
    const noi = v.highlights.find((m) => m.key === "noi")!;
    expect(noi.display).toBe("$195,000 / yr");
    expect(noi.exact).toMatchObject({ value: "195000.12345678", unit: "USD/year" });
    expect(v.highlights.find((m) => m.key === "paybackYears")!.display).toBe("6 years");
  });

  it("never turns an unavailable metric into zero and translates its reason", () => {
    const v = buildMemoView(complete(), "analyze");
    const yoc = v.highlights.find((m) => m.key === "yieldOnCost")!;
    expect(yoc.display).toBeNull();
    expect(yoc.unavailable).toBe("Needs a disclosed cost basis");
    expect(yoc.exact.value).toBeNull();
    expect(yoc.exact.reason).toMatch(/^[A-Z_]+$/);
    expect(friendlyUnavailable("NOT_APPLICABLE", false)).toBe("Not applicable to baseline");
    expect(friendlyUnavailable("NOT_APPLICABLE_OR_MISSING_COST_BASIS", true)).toBe("Not applicable to baseline");
    expect(friendlyUnavailable("MISSING_OR_UNDISCLOSED_TOTAL_PROJECT_COST", false)).toBe("Needs a disclosed cost basis");
    expect(friendlyUnavailable("Already a sentence.", false)).toBe("Already a sentence.");
    expect(html()).not.toContain("NOT_APPLICABLE_OR_MISSING_COST_BASIS</dd>");
  });

  it("merges only identical findings and keeps scenarios and every evidence id", () => {
    const r = complete();
    const check = { dimension: "legal" as const, status: "unverified" as const, code: "zoning", explanation: "Zoning is not verified.", evidenceIds: ["synthetic-assumption"] };
    r.comparison.feasibility[0].checks = [check];
    r.comparison.feasibility[1].checks = [{ ...check }];
    r.comparison.feasibility[2].checks = [
      { ...check },
      { ...check, status: "excluded", explanation: "Exceeds the $500,000 limit.", code: "budget", dimension: "financial" },
      { ...check, explanation: "Zoning is not verified for studios." },
    ];
    const v = buildMemoView(r, "risks");
    expect(v.findings).toHaveLength(3);
    expect(v.findings[0].status).toBe("excluded");
    const shared = v.findings.find((f) => f.explanation === "Zoning is not verified.")!;
    expect(shared.scenarios).toEqual(["baseline", "alternative-a", "alternative-b"]);
    expect(shared.evidenceIds).toEqual(["synthetic-assumption"]);
    expect(v.findings.find((f) => f.explanation.includes("studios"))!.scenarios).toEqual(["alternative-b"]);
    expect(v.warnings).toEqual([{ text: "Synthetic; legal feasibility unverified", scenarios: ["baseline", "alternative-a", "alternative-b"] }]);
  });

  it("groups activity in plain words without dropping executions", () => {
    const r = complete();
    r.execution.completedTools = [
      { toolCallId: "c1", name: "write_todos", evidenceIds: [] },
      { toolCallId: "c2", name: "runComparison", evidenceIds: [] },
      { toolCallId: "c3", name: "runComparison", evidenceIds: [] },
      { toolCallId: "c4", name: "verifyAnalysis", evidenceIds: [] },
    ];
    const v = buildMemoView(r, "analyze");
    expect(v.activity).toEqual([
      { label: "Planned the investigation", count: 1 },
      { label: "Calculated the scenario comparison", count: 2 },
      { label: "Checked the submitted claims", count: 1 },
    ]);
    expect(v.activity.reduce((n, a) => n + a.count, 0)).toBe(4);
    expect(activityLabel("getSpatialContext")).toBe("Retrieved spatial evidence");
    const h = html(r);
    const investor = h.slice(0, h.indexOf('data-testid="technical-audit"'));
    expect(investor).not.toContain("write_todos");
    expect(investor).not.toContain(">c2<");
    expect(h.slice(h.indexOf('data-testid="technical-audit"'))).toContain("write_todos");
  });

  it("discloses synthetic sources and labels mixed sources separately from verification", () => {
    const v = buildMemoView(complete(), "analyze");
    expect(v.sources).toMatchObject({ mixed: false, synthetic: true, combined: "synthetic" });
    expect(html()).toContain("Synthetic");
    const r = complete();
    r.property.dataMode = "licensed_cache";
    r.spatial.dataMode = "live";
    r.execution.sources = { propertyMode: "licensed_cache", spatialMode: "live" };
    r.execution.dataMode = "mixed";
    const mixed = html(r);
    expect(buildMemoView(r, "analyze").sources.mixed).toBe(true);
    expect(mixed).toContain("Mixed data sources");
    expect(mixed).toContain("property licensed cache, spatial live");
    expect(mixed).toContain("No verification receipt for this run");
  });

  it("claims a check only when the response carries a receipt, and states its scope", () => {
    expect(buildMemoView(complete(), "analyze").verification).toBeNull();
    const none = html();
    expect(none).toContain("No verification receipt for this run");
    expect(none).not.toContain("Bound claims verified");
    const r = complete();
    r.execution.verification = { status: "verified", method: "bound_claims_v1", submissionAttempts: 2, correctionAttempts: 1 };
    const h = html(r);
    expect(h).toContain("Checked against retrieved inputs and deterministic calculations");
    expect(h).toContain("Not checked: market accuracy of source records, zoning or legal permission, and physical suitability");
    expect(h).toContain("No per-statement verdict is reported");
    expect(h).toContain("1 corrective attempt");
  });

  it("a stale result renders nothing from the old analysis", () => {
    const h = html(complete(), true);
    expect(h).toContain("Analysis needs updating");
    expect(h).toContain("Inputs changed after this analysis ran");
    for (const gone of ["alternative-b", "$195,000", "investment-summary", "technical-audit", "synthetic-gemini"]) expect(h).not.toContain(gone);
    expect(renderToStaticMarkup(createElement(AnalysisResult, { response: needsInput, stale: true }))).not.toContain("analysis-needs-input");
  });

  it("names missing inputs in plain words and keeps the raw path available", () => {
    const h = renderToStaticMarkup(createElement(AnalysisResult, { response: needsInput, stale: false }));
    expect(h).toContain("Annual rent for baseline.");
    expect(h).toContain("Operating expenses for baseline.");
    expect(h).toContain("<code>scenarios.0.annualRentPerSqft</code>");
    expect(missingInputLabel("constraints.maxInitialInvestment", [])).toBe("Investment constraints");
    expect(missingInputLabel("something.else", [])).toBe("An input");
  });

  it("keeps the audit closed by default and a real disclosure", () => {
    const h = html();
    expect(h).toMatch(/<details[^>]*data-testid="technical-audit"/);
    expect(h).not.toMatch(/<details[^>]*open[^>]*data-testid="technical-audit"/);
    expect(h).toContain("Open the full pro forma for every scenario");
    expect(h).not.toContain("exactly as returned");
  });
});
