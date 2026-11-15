import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PropertyHero, PropertyPanel } from "@/features/property/property-panel";
import { property } from "../fixtures/contracts";

const header = (p = property) => renderToStaticMarkup(createElement(PropertyHero, { property: p }));
describe("sourced headline facts", () => {
  it("keeps unavailable and estimated metrics in details, not headline cards", () => {
    expect(header()).not.toContain(">Occupancy<");
    expect(header()).not.toContain(">Market rent<");
    const details = renderToStaticMarkup(createElement(PropertyPanel, { property }));
    expect(details).toContain("Occupancy");
    expect(details).toContain("Market rent");
  });
  it("shows a genuinely recorded zero occupancy instead of treating zero as missing", () => {
    const p = structuredClone(property);
    p.evidence[0].kind = "record";
    p.occupancyRatio = { ...p.occupancyRatio, value: "0", origin: "source_data" };
    expect(header(p)).toContain(">Occupancy<");
    expect(header(p)).toContain("0%");
  });
  it("omits source-labelled values lacking a displayable record reference", () => {
    const p = structuredClone(property);
    p.occupancyRatio.origin = "source_data";
    expect(header(p)).not.toContain(">Occupancy<");
    p.evidence[0].kind = "record";
    p.evidence[0].allowedUse.display = false;
    expect(header(p)).not.toContain(">Occupancy<");
  });
  it("shows sourced market rent without substituting financial scenario assumptions", () => {
    const p = structuredClone(property);
    p.evidence[0].kind = "record";
    p.marketRentAnnualPerSqft.origin = "source_data";
    expect(header(p)).toContain(">Market rent<");
  });
});
