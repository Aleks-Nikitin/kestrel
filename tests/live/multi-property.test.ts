import { it, expect } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { apiResponse, CatalogResponse, Property, SpatialContext } from "@/lib/contracts";
import { createIllustrativeInvestmentExample } from "@/lib/scenarios/illustrative-example";

it("selects every approved real property, preserves its spatial identity and clears old scenario results", async () => {
  const base = process.env.LIVE_BASE_URL || "http://localhost:4323";
  let stage = "catalog", ordinal = 0;
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  try {
    const catalog = apiResponse(CatalogResponse).parse(await (await fetch(base + "/api/v1/properties")).json());
    if (!catalog.ok) throw Error("Catalog unavailable");
    expect(catalog.data.properties.length === 5).toBe(true);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let analysisRequests = 0, compareRequests = 0;
    page.on("request", r => { if (r.url().endsWith("/api/v1/analysis")) analysisRequests++; if (r.url().endsWith("/api/v1/scenarios/compare")) compareRequests++; });
    await page.goto(base);
    let published = 0;
    for (const item of catalog.data.properties) {
      ordinal++; stage = "selection";
      const property = apiResponse(Property).parse(await (await fetch(base + "/api/v1/properties/" + encodeURIComponent(item.id))).json());
      const spatial = apiResponse(SpatialContext).parse(await (await fetch(base + "/api/v1/properties/" + encodeURIComponent(item.id) + "/spatial")).json());
      if (!property.ok || !spatial.ok) throw Error("Authorized details unavailable");
      expect(property.data.id === item.id && spatial.data.propertyId === item.id).toBe(true);
      const hasScan = spatial.data.model !== null;
      expect(hasScan ? spatial.data.match.status === "verified" && spatial.data.model?.commercialPropertyId === item.id : spatial.data.match.status === "unmatched" && spatial.data.dataMode === "unavailable").toBe(true);
      expect(spatial.data.evidence.every(e => e.propertyId === item.id)).toBe(true);
      await page.getByRole("list", { name: "Properties" }).getByRole("button").nth(ordinal - 1).click();
      await browserExpect(page.getByTestId("comparison-result")).toHaveCount(0);
      await browserExpect(page.getByTestId("analysis-complete")).toHaveCount(0);
      if (hasScan) await browserExpect(page.getByTestId("room-measurements")).toBeVisible();
      else await browserExpect(page.getByTestId("room-measurements")).toHaveCount(0);
      expect((await page.locator("#property-heading").textContent())?.trim() === property.data.address.value).toBe(true);
      const tabs = page.getByRole("tab"); await browserExpect(tabs.nth(2)).toBeVisible();
      await tabs.nth(1).click();
      await browserExpect(page.getByRole("tabpanel").getByLabel(/^Annual rent/)).toHaveValue("");
      stage = "tour-identity";
      if (spatial.data.model?.showcase) {
        await browserExpect(page.getByRole("radio", { name: "3D Tour", exact: true })).toBeEnabled();
        await page.getByRole("radio", { name: "3D Tour", exact: true }).locator("..").click();
        const iframe = page.locator("iframe").first(); await browserExpect(iframe).toBeVisible();
        const url = new URL((await iframe.getAttribute("src"))!);
        expect(url.searchParams.get("m") === spatial.data.model.id).toBe(true);
        expect(!url.searchParams.has("sr") && !url.searchParams.has("ss")).toBe(true);
        await iframe.scrollIntoViewIfNeeded(); await iframe.hover();
        const scene = page.frameLocator("iframe").first();
        stage = "embedded-canvas";
        await scene.locator("canvas").first().waitFor({ state: "visible", timeout: 45000 });
        const dollhouse = scene.locator('[aria-label*="Dollhouse"]:visible,[title*="Dollhouse"]:visible,[aria-label*="dollhouse"]:visible,[title*="dollhouse"]:visible').first();
        stage = "embedded-dollhouse";
        await dollhouse.waitFor({ state: "visible", timeout: 45000 });
        await dollhouse.click();
        stage = "embedded-walk";
        const walk = scene.getByRole("button", { name: /3D\s*space/i }).first();
        if (await walk.isVisible()) await walk.click();
        await page.waitForTimeout(1000);
        if (ordinal === 1 && process.env.KESTREL_PRIVATE_VISUAL_CHECK === "true")
          await iframe.screenshot({ path: "/private/tmp/kestrel-catalog-upright.png" });
        const full = page.getByRole("button", { name: "Full screen", exact: true });
        if (await full.isVisible()) {
          stage = "fullscreen-enter";
          await full.click();
          await browserExpect(page.getByRole("button", { name: "Exit full screen", exact: true })).toBeVisible();
          expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
          stage = "fullscreen-exit";
          await page.getByRole("button", { name: "Exit full screen", exact: true }).click();
        }
        stage = "mobile-viewer";
        await page.setViewportSize({ width: 390, height: 844 });
        const size = await iframe.boundingBox();
        expect(!!size && size.width <= 390 && size.height >= 320).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.setViewportSize({ width: 1440, height: 1000 });
        published++;
        await page.getByRole("radio", { name: "2D Map", exact: true }).locator("..").click();
      } else {
        await browserExpect(page.locator("iframe")).toHaveCount(0);
        if (await page.getByRole("radio", { name: "3D Tour", exact: true }).isChecked())
          await page.getByRole("button", { name: "Back to 2D map", exact: true }).click();
        await browserExpect(page.getByRole("radio", { name: "3D Tour", exact: true })).toBeDisabled();
      }
      stage = "editor";
      const example = createIllustrativeInvestmentExample(property.data, 2026);
      if (!example.ok) throw Error("Complete illustrative inputs unavailable");
      const callsBefore = compareRequests;
      const revisionBadge = page.locator("#section-scenarios").getByText(/^Input revision/).first();
      const beforeRevision = Number((await revisionBadge.textContent())?.match(/\d+/)?.[0]);
      await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
      await browserExpect(page.getByTestId("illustrative-confirm")).toHaveCount(0);
      await browserExpect(revisionBadge).toHaveText(`Input revision ${beforeRevision + 1}`);
      await browserExpect(page.getByTestId("illustrative-disclosure")).toContainText("hypothetical");
      await browserExpect(page.getByLabel(/^Maximum initial investment/)).toHaveValue("2000000");
      expect(compareRequests === callsBefore && analysisRequests === 0).toBe(true);
      stage = "comparison";
      const pending = page.waitForResponse(r => r.url().endsWith("/api/v1/scenarios/compare") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Calculate comparison", exact: true }).click();
      const response = await pending, body = await response.json();
      expect(response.status() === 200 && body.ok && body.data.propertyId === item.id && body.data.scenarios.every((s: { propertyId: string }) => s.propertyId === item.id)).toBe(true);
      await browserExpect(page.getByTestId("comparison-result")).toBeVisible();
      if (ordinal === 1) {
        expect(body.data.comparison.preferredScenarioId === "alternative-b").toBe(true);
        await page.getByLabel(/^Maximum initial investment/).fill("1000000");
        await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
        await browserExpect(page.getByTestId("illustrative-confirm")).toBeVisible();
        await page.getByRole("button", { name: "Keep my drafts", exact: true }).click();
        await browserExpect(page.getByLabel(/^Maximum initial investment/)).toHaveValue("1000000");
        const changed = page.waitForResponse(r => r.url().endsWith("/api/v1/scenarios/compare") && r.request().method() === "POST");
        await page.getByRole("button", { name: "Recalculate", exact: true }).click();
        const revised = await (await changed).json();
        expect(revised.ok && revised.data.propertyId === item.id && revised.data.comparison.preferredScenarioId === "alternative-a").toBe(true);
        await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
        await page.getByRole("button", { name: "Replace drafts", exact: true }).click();
        await browserExpect(page.getByLabel(/^Maximum initial investment/)).toHaveValue("2000000");
        await browserExpect(page.getByTestId("comparison-result")).toHaveAttribute("data-stale", "true");
        const again = page.waitForResponse(r => r.url().endsWith("/api/v1/scenarios/compare") && r.request().method() === "POST");
        await page.getByRole("button", { name: "Recalculate", exact: true }).click();
        const reset = await (await again).json(); expect(reset.ok && reset.data.comparison.preferredScenarioId === "alternative-b").toBe(true);
        // Switch away while the original tour is open: an unpublished next
        // property must remove that iframe rather than retain the old building.
        await page.getByRole("radio", { name: "3D Tour", exact: true }).locator("..").click();
      }
      console.info("Real catalog property passed", { ordinal, selectedRecord: true, explicitSpatialIdentity: true, availableMeasurements: hasScan, matchingTourOnly: true, priorStateCleared: true, illustrativeButton: true, oneRevisionBump: true, comparisonCurrentProperty: true });
    }
    stage = "switch-back";
    await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
    await browserExpect(page.getByTestId("comparison-result")).toHaveCount(0);
    await browserExpect(page.getByTestId("room-measurements")).toBeVisible();
    await page.getByRole("tab").nth(1).click();
    await browserExpect(page.getByRole("tabpanel").getByLabel(/^Annual rent/)).toHaveValue("");
    expect(analysisRequests).toBe(0);
    console.info("Bounded real catalog verified", { properties: ordinal, publishedTours: published, paidAnalysisCalls: analysisRequests });
  } catch { throw Error(`Real multi-property check failed at ordinal ${ordinal}, stage ${stage}; restricted values withheld.`); }
  finally { await browser.close(); }
}, 180000);
