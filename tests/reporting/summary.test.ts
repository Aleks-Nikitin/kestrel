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
