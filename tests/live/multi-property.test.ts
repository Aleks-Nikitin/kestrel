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
    expect(catalog.data.properties.length === 4).toBe(true);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let analysisRequests = 0;
    page.on("request", r => { if (r.url().endsWith("/api/v1/analysis")) analysisRequests++; });
    await page.goto(base);
    const startLabel = (s: string) => new RegExp("^" + Array.from(s, c => /[A-Za-z0-9 ]/.test(c) ? c : "\\" + c).join(""));
    let published = 0;
    for (const item of catalog.data.properties) {
      ordinal++; stage = "selection";
      const property = apiResponse(Property).parse(await (await fetch(base + "/api/v1/properties/" + encodeURIComponent(item.id))).json());
      const spatial = apiResponse(SpatialContext).parse(await (await fetch(base + "/api/v1/properties/" + encodeURIComponent(item.id) + "/spatial")).json());
      if (!property.ok || !spatial.ok) throw Error("Authorized details unavailable");
      expect(property.data.id === item.id && spatial.data.propertyId === item.id && spatial.data.match.status === "verified" && spatial.data.model?.commercialPropertyId === item.id).toBe(true);
      expect(spatial.data.evidence.every(e => e.propertyId === item.id)).toBe(true);
      await page.getByRole("list", { name: "Properties" }).getByRole("button").nth(ordinal - 1).click();
      await browserExpect(page.getByTestId("comparison-result")).toHaveCount(0);
      await browserExpect(page.getByTestId("analysis-complete")).toHaveCount(0);
      await browserExpect(page.getByTestId("room-measurements")).toBeVisible();
      expect((await page.locator("#property-heading").textContent())?.trim() === property.data.address.value).toBe(true);
      const tabs = page.getByRole("tab"); await browserExpect(tabs.nth(2)).toBeVisible();
      await tabs.nth(1).click();
      await browserExpect(page.getByRole("tabpanel").getByLabel(/^Annual rent/)).toHaveValue("");
      stage = "tour-identity";
      if (spatial.data.model?.showcase) {
        await browserExpect(page.getByRole("radio", { name: "3D Tour", exact: true })).toBeEnabled();
        await page.getByRole("radio", { name: "3D Tour", exact: true }).locator("..").click();
        const iframe = page.locator("iframe").first(); await browserExpect(iframe).toBeVisible();
        expect(new URL((await iframe.getAttribute("src"))!).searchParams.get("m") === spatial.data.model.id).toBe(true);
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
      const model = example.model;
      for (let i = 0; i < 3; i++) {
        await tabs.nth(i).click(); const panel = page.getByRole("tabpanel"), s = model.scenarios[i];
        await panel.getByLabel(/^Name/).fill(s.name); await panel.getByLabel(/^Proposed use/).fill(s.proposedUse);
        await panel.getByLabel(/^Lease basis/).selectOption("gross");
        await panel.getByLabel(/^Rent normalization note/).fill(s.rentNormalizationNote);
        for (const [label, key] of Object.entries({ "Rentable area": "rentableAreaSqft", "Annual rent": "annualRentPerSqft", "Occupancy": "occupancyRatio", "Collection loss": "collectionLossRatio", "Concessions": "annualConcessions", "Total operating expenses": "expenseTotal", "Total project cost (optional)": "totalProjectCost" }) as [string, keyof typeof s][]) {
          const value = s[key] as { text: string }; await panel.getByLabel(startLabel(label)).fill(value.text);
        }
        await panel.getByRole("radio", { name: "No other income modeled", exact: true }).check();
        await panel.getByLabel(/^Costs included in the total/).fill(s.expenseTotalNote);
        await panel.getByLabel(/^Total project cost basis/).fill(s.totalProjectCostNote);
        if (i) for (const [label, key] of Object.entries({ Renovation: "renovation", Conversion: "conversion", "Soft costs": "softCosts", Contingency: "contingency", "Other capital": "other" }) as [string, keyof typeof s.capex][]) await panel.getByLabel(startLabel(label)).fill(s.capex[key].text);
        await panel.getByLabel(/^Assumptions/).fill(s.assumptions);
      }
      await page.getByLabel(/^Maximum initial investment/).fill("2000000");
      await page.getByLabel(/^Maximum simple payback/).fill("10");
      stage = "comparison";
      const pending = page.waitForResponse(r => r.url().endsWith("/api/v1/scenarios/compare") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Calculate comparison", exact: true }).click();
      const response = await pending, body = await response.json();
      expect(response.status() === 200 && body.ok && body.data.propertyId === item.id && body.data.scenarios.every((s: { propertyId: string }) => s.propertyId === item.id)).toBe(true);
      await browserExpect(page.getByTestId("comparison-result")).toBeVisible();
      if (ordinal === 1) {
        expect(body.data.comparison.preferredScenarioId === "alternative-b").toBe(true);
        await page.getByLabel(/^Maximum initial investment/).fill("1000000");
        const changed = page.waitForResponse(r => r.url().endsWith("/api/v1/scenarios/compare") && r.request().method() === "POST");
        await page.getByRole("button", { name: "Recalculate", exact: true }).click();
        const revised = await (await changed).json();
        expect(revised.ok && revised.data.propertyId === item.id && revised.data.comparison.preferredScenarioId === "alternative-a").toBe(true);
        // Switch away while the original tour is open: an unpublished next
        // property must remove that iframe rather than retain the old building.
        await page.getByRole("radio", { name: "3D Tour", exact: true }).locator("..").click();
      }
      console.info("Real catalog property passed", { ordinal, selectedRecord: true, explicitSpatialIdentity: true, availableMeasurements: true, matchingTourOnly: true, priorStateCleared: true, comparisonCurrentProperty: true });
    }
    expect(analysisRequests).toBe(0);
    console.info("Bounded real catalog verified", { properties: ordinal, publishedTours: published, paidAnalysisCalls: analysisRequests });
  } catch { throw Error(`Real multi-property check failed at ordinal ${ordinal}, stage ${stage}; restricted values withheld.`); }
  finally { await browser.close(); }
}, 180000);
