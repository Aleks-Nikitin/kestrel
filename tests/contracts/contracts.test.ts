import { describe, expect, it } from "vitest";
import {
  AnalysisRequest,
  AnalysisResponse,
  ComparisonRequest,
  ComparisonResponse,
  Property,
  SpatialContext,
  apiResponse,
} from "@/lib/contracts";
import * as f from "../fixtures/contracts";
describe("shared synthetic contracts", () => {
  it.each([
    f.f01,
    f.f02,
    f.f03,
    f.f04,
    f.f04Edited,
    f.revisedBudget,
    f.missingInputs,
    f.editedResubmission,
  ])("parses approved financial requests", (input) =>
    expect(ComparisonRequest.safeParse(input).success).toBe(true),
  );
  it.each([f.analysis, f.fallbackAnalysis, f.needsInput])(
    "parses complete, fallback and needs-input fixtures",
    (data) =>
      expect(
        apiResponse(AnalysisResponse).safeParse(f.success(data)).success,
      ).toBe(true),
  );
  it.each(Object.values(f.errors))("parses safe failure fixtures", (data) =>
    expect(apiResponse(AnalysisResponse).safeParse(data).success).toBe(true),
  );
  it("accepts additive verification proof only with a completed verifier receipt", () => {
    const x = structuredClone(f.analysis);
    if (x.status !== "complete") throw Error("fixture");
    const verified = { ...x, execution: { ...x.execution, verification: {
      status: "verified", method: "bound_claims_v1", submissionAttempts: 2, correctionAttempts: 1,
    } } };
    expect(AnalysisResponse.safeParse(verified).success).toBe(false);
    verified.execution.completedTools.push({ name: "verifyAnalysis", toolCallId: "verified-receipt", evidenceIds: [] });
    expect(AnalysisResponse.safeParse(verified).success).toBe(true);
    verified.execution.verification.correctionAttempts = 0;
    expect(AnalysisResponse.safeParse(verified).success).toBe(false);
  });
  it("parses catalog layers and comparison states", () => {
    Property.parse(f.property);
    [f.spatial, f.missingImagery, f.mismatchedSpatial].forEach((x) =>
      SpatialContext.parse(x),
    );
    ComparisonResponse.parse(f.comparison);
    ComparisonResponse.parse(f.insufficientEvidence);
    ComparisonResponse.parse(f.revisedComparison);
  });
  it("rejects client provenance forgery", () =>
    expect(ComparisonRequest.safeParse(f.originForgery).success).toBe(false));
  it("rejects wrong units, identity and duplicate scenarios", () => {
    for (const mutate of [
      (x: typeof f.f01) => {
        x.scenarios[1].propertyId = "other";
      },
      (x: typeof f.f01) => {
        x.scenarios[1].id = x.scenarios[0].id;
      },
      (x: typeof f.f01) => {
        Object.assign(x.scenarios[0].annualRentPerSqft, { unit: "USD/month" });
      },
    ]) {
      const x = structuredClone(f.f01);
      mutate(x);
      expect(ComparisonRequest.safeParse(x).success).toBe(false);
    }
  });
  it("rejects wrong currency, period, rates and baseline investment", () => {
    for (const change of [
      { currency: "EUR" },
      { occupancyRatio: { value: "1.1" } },
      {
        period: {
          start: "2026-01-01",
          end: "2026-12-31",
          basis: "stabilized_annual",
        },
      },
      { capex: { ...f.f01.scenarios[0].capex, renovation: { value: "1" } } },
    ]) {
      const x = structuredClone(f.f01);
      Object.assign(x.scenarios[0], change);
      expect(ComparisonRequest.safeParse(x).success).toBe(false);
    }
  });
  it("accepts a baseline draft only for initial analysis", () => {
    const x = { ...f.f01, scenarios: [f.f01.scenarios[0]], action: "analyze" };
    expect(AnalysisRequest.safeParse(x).success).toBe(true);
    expect(AnalysisRequest.safeParse({ ...x, action: "summary" }).success).toBe(
      false,
    );
  });
  it("rejects unresolvable summary, evidence and revision references", () => {
    const x = structuredClone(f.analysis);
    if (x.status !== "complete") throw Error("fixture");
    x.summary.claims[0].metricRefs = ["other.noi"];
    expect(AnalysisResponse.safeParse(x).success).toBe(false);
    const y = structuredClone(f.comparison);
    y.comparison.inputRevision++;
    expect(ComparisonResponse.safeParse(y).success).toBe(false);
    const p = structuredClone(f.property);
    p.evidence[0].propertyId = "other";
    expect(Property.safeParse(p).success).toBe(false);
  });
  it("rejects mismatched Matterport IDs and unverified dependent claims", () => {
    const x = structuredClone(f.spatial);
    x.model!.commercialPropertyId = "other";
    expect(SpatialContext.safeParse(x).success).toBe(false);
    const y = structuredClone(f.spatial);
    y.match.status = "unmatched";
    expect(SpatialContext.safeParse(y).success).toBe(false);
  });
  it("rejects signed URLs in evidence", () => {
    const x = structuredClone(f.property);
    x.evidence[0].sourceUrl = "https://example.com/image?token=secret";
    expect(Property.safeParse(x).success).toBe(false);
  });
  it("rejects mixed provenance and impossible property area", () => {
    const x = structuredClone(f.property);
    x.rentableAreaSqft.value = "13000";
    expect(Property.safeParse(x).success).toBe(false);
  });
});
