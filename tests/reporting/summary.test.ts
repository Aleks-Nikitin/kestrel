import { expect, it } from "vitest";
import { InvestmentSummary } from "@/lib/contracts";
import { buildInvestmentSummary } from "@/lib/reporting/summary";
import {
  property,
  spatial,
  comparison,
  insufficientEvidence,
  timestamp,
} from "../fixtures/contracts";
it("builds an inspectable deterministic report from canonical metrics and winner", () => {
  const summary = buildInvestmentSummary({
    property,
    spatial,
    response: comparison,
    generatedAt: timestamp,
  });
  InvestmentSummary.parse(summary);
  expect(summary.preferredScenarioId).toBe("alternative-b");
  expect(summary.claims.some(c => c.metricRefs.includes("alternative-b.noi") && c.evidenceIds.length > 0)).toBe(true);
  expect(summary.claims.some(c => c.kind === "fact")).toBe(false);
  expect(
    summary.claims.some(
      (c) =>
        c.text.includes("195000") && c.metricRefs.includes("alternative-b.noi"),
    ),
  ).toBe(true);
  expect(summary.limitations.some((t) => t.includes("not an appraisal"))).toBe(
    true,
  );
});
it("does not name a preferred scenario when evidence is insufficient", () => {
  const summary = buildInvestmentSummary({
    property,
    spatial,
    response: insufficientEvidence,
  });
  expect(summary.preferredScenarioId).toBeNull();
  expect(summary.headline).toMatch(/More evidence/);
});

it("ties sourced area and qualified spatial observations to their actual evidence", () => {
 const p=structuredClone(property);p.rentableAreaSqft.origin="source_data";
 const report=buildInvestmentSummary({property:p,spatial,response:comparison});
 expect(report.claims.some(c=>c.kind==="fact"&&c.text.includes("rentable area")&&c.evidenceIds.length>0)).toBe(true);
 for(const observation of spatial.observations)expect(report.claims.some(c=>c.text===observation.statement&&JSON.stringify(c.evidenceIds)===JSON.stringify(observation.evidenceIds))).toBe(true);
});
