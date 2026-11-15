import { test, expect, type Page } from "@playwright/test";
import { CatalogResponse } from "@/lib/contracts";
import { property, spatial, success } from "../tests/fixtures/contracts";

async function open(page: Page) {
  const p = structuredClone(property);
  p.evidence[0].kind = "record";
  p.rentableAreaSqft.origin = "source_data";
  p.occupancyRatio = { ...p.occupancyRatio, value: null, origin: "unknown", evidenceIds: [], note: "Not supplied in fictional source" };
  const catalog = CatalogResponse.parse({ contractVersion: "1", properties: [{ id: p.id, address: p.address,
    location: p.location, propertyType: p.propertyType, dataMode: p.dataMode, evidence: p.evidence }], nextCursor: null });
  let apiCalls = 0;
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls++; });
  await page.route("**/api/v1/properties", r => r.fulfill({ json: success(catalog) }));
  await page.route(`**/api/v1/properties/${p.id}`, r => r.fulfill({ json: success(p) }));
  await page.route(`**/api/v1/properties/${p.id}/spatial`, r => r.fulfill({ json: success(spatial) }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  await expect(page.getByTestId("room-measurements")).toBeVisible();
  return { calls: () => apiCalls, p };
}

test("headline hides unavailable and estimated metrics while details and subtle limitations remain", async ({ page }) => {
  await open(page);
  const facts = page.getByRole("list", { name: "Headline facts" });
  await expect(facts).toContainText("Rentable area");
  await expect(facts).not.toContainText("Occupancy");
  await expect(facts).not.toContainText("Market rent");
  const details = page.getByRole("region", { name: "Property data and provenance" });
  await expect(details).toContainText("Occupancy");
  await expect(details).toContainText("Market rent");
  await expect(page.getByRole("banner")).not.toContainText("Preliminary");
  await expect(page.getByText(/Not an appraisal, zoning determination or structural inspection\./)).toHaveCount(1);
  await expect(page.locator("footer")).toContainText("Preliminary investment screening only");
  const summary = page.getByTestId("readiness-summary");
  await expect(summary).toContainText("You can calculate a partial comparison now");
  await summary.getByText("Review 37 scenario-input gaps", { exact: true }).click();
  await expect(summary).toContainText("Current use (baseline): 8 input gaps");
  await expect(summary).toContainText("Alternative A: 14 input gaps");
  await expect(summary).toContainText("Alternative B: 14 input gaps");
  await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
  await expect(summary).toHaveCount(0);
});

test("header and footer logo navigate by keyboard and pointer without clearing drafts or fetching", async ({ page }) => {
  const state = await open(page);
  await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
  await page.getByRole("tabpanel").getByLabel(/^Annual rent/).fill("14.25");
  await page.getByLabel(/Question for the analyst/).fill("Retain this draft question");
  const calls = state.calls();
  const logo = page.getByRole("banner").getByRole("link", { name: "Kestrel overview", exact: true });
  await logo.focus(); await logo.press("Enter");
  await expect(page.locator("#overview")).toBeFocused();
  await expect(page).toHaveURL(/#overview$/);
  await expect(page.locator("#property-heading")).toHaveText(state.p.address.value!);
  await expect(page.getByRole("tabpanel").getByLabel(/^Annual rent/)).toHaveValue("14.25");
  await expect(page.getByLabel(/Question for the analyst/)).toHaveValue("Retain this draft question");
  await page.locator("#section-scenarios").scrollIntoViewIfNeeded();
  await logo.click();
  await expect(page.locator("#overview")).toBeFocused();
  await page.locator("footer").getByRole("link", { name: "Kestrel overview", exact: true }).click();
  await expect(page.locator("#overview")).toBeFocused();
  expect(state.calls()).toBe(calls);
  await expect(page.getByRole("tabpanel").getByLabel(/^Annual rent/)).toHaveValue("14.25");
});
