import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComparisonView } from "@/features/scenarios/comparison-view";
import { comparison } from "../fixtures/contracts";

describe("comparison recommendation presentation", () => {
  it("shows repeated per-scenario warnings once without mutating the response", () => {
    const response = structuredClone(comparison);
    response.comparison.reasons = response.scenarios.map((scenario) => ({
      code: "LEGAL_UNVERIFIED",
      text: "Confirm the proposed use with the relevant authority.",
      scenarioIds: [scenario.id],
      evidenceIds: [],
    }));
    const before = JSON.stringify(response);
    const html = renderToStaticMarkup(createElement(ComparisonView, { response, stale: false }));
    expect(html.match(/Confirm the proposed use with the relevant authority\./g)).toHaveLength(1);
    expect(html).not.toContain("Applies to:");
    expect(JSON.stringify(response)).toBe(before);
  });

  it("preserves distinct explanations sharing a code and their scenario attribution", () => {
    const response = structuredClone(comparison);
    response.comparison.reasons = response.scenarios.slice(1).map((scenario, i) => ({
      code: "REVIEW_REQUIRED",
      text: `Distinct requirement ${i + 1}.`,
      scenarioIds: [scenario.id],
      evidenceIds: [],
    }));
    const html = renderToStaticMarkup(createElement(ComparisonView, { response, stale: false }));
    for (const [i, scenario] of response.scenarios.slice(1).entries()) {
      expect(html).toContain(`Distinct requirement ${i + 1}.`);
      expect(html).toContain(`Applies to: ${scenario.name}`);
    }
  });

  it("omits a repeated subtitle but keeps a distinct proposed use", () => {
    const response = structuredClone(comparison);
    const preferred = response.scenarios.find((s) => s.id === response.comparison.preferredScenarioId)!;
    preferred.name = "Unique preferred label";
    preferred.proposedUse = preferred.name;
    const render = () => renderToStaticMarkup(createElement(ComparisonView, { response, stale: false }));
    expect(render()).not.toContain('<p class="mt-2 text-base');
    preferred.proposedUse = "Distinct proposed use";
    expect(render()).toContain("Distinct proposed use</p>");
  });
});
