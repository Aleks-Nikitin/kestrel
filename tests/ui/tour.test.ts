import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpatialContext } from "@/lib/contracts";
import { mismatchedSpatial, propertyId, spatial } from "../fixtures/contracts";
import { Explorer, TourPanel } from "@/features/map/explorer";
import { NO_SID_REASON, parseStartView, resolveTour, showcaseUrl, startViewOf, type TourState } from "@/features/map/tour";

const ready = (data: typeof spatial) => ({ status: "ready" as const, data });
const SID = "SxQL3iGyoDo";
const withSid = () => SID;

describe("resolveTour", () => {
  it("is unavailable until a property is selected", () => {
    expect(resolveTour({ status: "idle" }, null).status).toBe("unavailable");
  });
  it("is checking while spatial evidence loads or belongs to another property", () => {
    expect(resolveTour({ status: "loading" }, propertyId).status).toBe("checking");
    expect(resolveTour(ready(spatial), "other-property").status).toBe("checking");
  });
  it("keeps a private or unpublished model unavailable without publication proof", () => {
    expect(resolveTour(ready(spatial), propertyId)).toEqual({ status: "unavailable", reason: NO_SID_REASON });
  });
  it("enables the existing viewer from verified matching publication metadata", () => {
    const published = SpatialContext.parse({
      ...spatial,
      model: {
        ...spatial.model!,
        id: SID,
        showcase: { sid: SID, verifiedAt: "2026-11-14T18:00:00Z" },
      },
    });
    expect(resolveTour(ready(published), propertyId)).toEqual({
      status: "available",
      sid: SID,
      url: showcaseUrl(SID),
    });
  });
  it("rejects proof for a different model or an unverified/non-Matterport layer", () => {
    const published = {
      ...spatial,
      model: {
        ...spatial.model!,
        id: SID,
        showcase: { sid: SID, verifiedAt: "2026-11-14T18:00:00Z" },
      },
    };
    expect(SpatialContext.safeParse({
      ...published,
      model: { ...published.model, id: spatial.model!.id },
    }).success).toBe(false);
    expect(SpatialContext.safeParse({ ...published, provider: "vexcel" }).success).toBe(false);
    expect(SpatialContext.safeParse({
      ...published,
      match: { ...published.match, status: "ambiguous" },
    }).success).toBe(false);
  });
  it("is unavailable for unverified or unmatched models", () => {
    const r = resolveTour(ready(mismatchedSpatial), mismatchedSpatial.propertyId, withSid);
    expect(r.status).toBe("unavailable");
    expect(r.status === "unavailable" && r.reason).toMatch(/verified/);
  });
  it("is unavailable without a model", () => {
    const r = resolveTour(ready({ ...spatial, model: null }), propertyId, withSid);
    expect(r.status).toBe("unavailable");
  });
  it("rejects malformed SIDs", () => {
    for (const bad of ["short", "has space!!", "../etc/passwd", "x".repeat(40)])
      expect(resolveTour(ready(spatial), propertyId, () => bad).status).toBe("unavailable");
  });
  it("builds the Showcase URL only from a verified SID", () => {
    const t = resolveTour(ready(spatial), propertyId, withSid);
    expect(t).toEqual({ status: "available", sid: SID, url: showcaseUrl(SID) });
    expect(showcaseUrl(SID)).toBe(`https://my.matterport.com/show/?m=${SID}&play=1`);
    expect(showcaseUrl(SID)).not.toMatch(/key|token/i);
  });
});

describe("TourPanel", () => {
  const noop = () => {};
  const html = (tour: TourState) =>
    renderToStaticMarkup(createElement(TourPanel, { tour, title: "Tour", onBack: noop }));
  it("explains unavailability and offers a way back", () => {
    const h = html({ status: "unavailable", reason: "No verified Matterport match for this property." });
    expect(h).toContain("No 3D tour for this property");
    expect(h).toContain("No verified Matterport match");
    expect(h).toContain("Back to 2D map");
    expect(h).not.toContain("<iframe");
  });
  it("shows a checking state with a way back", () => {
    const h = html({ status: "checking" });
    expect(h).toContain("Checking for a verified 3D tour");
    expect(h).toContain("Back to 2D map");
  });
  it("renders a sandboxed, lazy, titled iframe for an available tour", () => {
    const h = html({ status: "available", sid: SID, url: showcaseUrl(SID) });
    expect(h).toContain("<iframe");
    expect(h).toContain(`src="${showcaseUrl(SID).replace(/&/g, "&amp;")}"`);
    // Not lazy: a lazy iframe can delay its load event and trigger a false "slow" notice.
    expect(h).not.toContain('loading="lazy"');
    expect(h).toContain("sandbox=");
    expect(h).toContain('title="Tour"');
  });
});

describe("Explorer switch", () => {
  const props = { properties: [], selectedId: propertyId, onSelect: () => {}, footprint: null, tourTitle: "Tour" };
  const html = (tour: TourState) => renderToStaticMarkup(createElement(Explorer, { ...props, tour }));
  it("defaults to the 2D map and does not load the iframe", () => {
    const h = html({ status: "available", sid: SID, url: showcaseUrl(SID) });
    expect(h).not.toContain("<iframe");
    expect(h).toMatch(/<input(?=[^>]*value="2d")(?=[^>]*checked)[^>]*>/);
    expect(h).not.toMatch(/<input(?=[^>]*value="3d")(?=[^>]*disabled)[^>]*>/);
  });
  it("disables 3D with a stated reason when no tour is available", () => {
    const h = html({ status: "unavailable", reason: NO_SID_REASON });
    expect(h).toMatch(/<input(?=[^>]*value="3d")(?=[^>]*disabled)[^>]*>/);
    expect(h).toContain("3D tour unavailable");
    expect(h).toContain("does not include an embeddable Matterport Showcase model");
  });
});

describe("optional start view", () => {
  it("leaves the URL unchanged when no start view is supplied", () => {
    expect(showcaseUrl(SID)).toBe(`https://my.matterport.com/show/?m=${SID}&play=1`);
    expect(startViewOf(spatial)).toBeNull();
  });
  it("appends a validated sweep and rotation exactly as supplied", () => {
    const v = parseStartView({ ss: "34", sr: ",-1.04" });
    expect(v).toEqual({ ss: "34", sr: ",-1.04" });
    expect(showcaseUrl(SID, v)).toBe(`https://my.matterport.com/show/?m=${SID}&play=1&ss=34&sr=,-1.04`);
    expect(showcaseUrl(SID, parseStartView({ ss: "7" }))).toBe(`https://my.matterport.com/show/?m=${SID}&play=1&ss=7`);
  });
  it("drops malformed values instead of putting them in a URL", () => {
    expect(parseStartView({ ss: "34&evil=1" })).toBeNull();
    expect(parseStartView({ ss: 34 })).toBeNull();
    expect(parseStartView(null)).toBeNull();
    expect(parseStartView({ ss: "3", sr: "1;2" })).toEqual({ ss: "3" });
    expect(parseStartView({ ss: "3", sr: "," })).toEqual({ ss: "3" });
  });
  it("uses a server-supplied start view when resolving the tour", () => {
    const published = SpatialContext.parse({
      ...spatial,
      model: { ...spatial.model!, id: SID, showcase: { sid: SID, verifiedAt: "2026-11-14T18:00:00Z", startView: { ss: "34", sr: ",-1.04" } } },
    });
    const t = resolveTour(ready(published), propertyId);
    expect(t).toMatchObject({ status: "available", url: `https://my.matterport.com/show/?m=${SID}&play=1` });
    expect(resolveTour(ready(published), propertyId, undefined, startViewOf)).toMatchObject({
      url: expect.stringContaining("&ss=34&sr=,-1.04"),
    });
  });
});
