import { expect, test, type Page } from "@playwright/test";
import { CatalogResponse, ComparisonRequest } from "@/lib/contracts";
import { answeringRevision } from "./helpers/revision";
import { prepareValidScenarios } from "./helpers/scenario";
import { openStage, useUnderwritingMode } from "./helpers/stage";
import { comparison, property, propertyId, spatial, success } from "../tests/fixtures/contracts";

// Quick Analysis and Advanced Underwriting are two views of one draft model.
// Synthetic fixtures are injected at the network boundary only.
const catalog = CatalogResponse.parse({
  contractVersion: "1",
  properties: [
    {
      id: property.id,
      address: property.address,
      location: property.location,
      propertyType: property.propertyType,
      dataMode: property.dataMode,
      evidence: property.evidence,
    },
  ],
  nextCursor: null,
});

async function open(page: Page, served = property) {
  const compareRequests: unknown[] = [];
  let apiCalls = 0;
  page.on("request", (q) => {
    if (new URL(q.url()).pathname.startsWith("/api/")) apiCalls += 1;
  });
  await page.route("**/api/v1/properties", (r) => r.fulfill({ json: success(catalog) }));
  await page.route(`**/api/v1/properties/${propertyId}`, (r) => r.fulfill({ json: success(served) }));
  await page.route(`**/api/v1/properties/${propertyId}/spatial`, (r) => r.fulfill({ json: success(spatial) }));
  await page.route("**/api/v1/scenarios/compare", async (r) => {
    const sent = r.request().postDataJSON();
    compareRequests.push(sent);
    await r.fulfill({ json: answeringRevision(success(comparison), sent) });
  });
  await page.goto("/");
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  await prepareValidScenarios(page);
  return { compareRequests, calls: () => apiCalls };
}

const panel = (page: Page) => page.getByRole("tabpanel");
const revision = (page: Page) => page.getByText(/^Input revision \d+$/);

test("Quick Analysis is the default and shows only a few inputs", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("group", { name: "Underwriting view" }).getByRole("radio", { name: "Quick Analysis" })).toBeChecked();
  await expect(panel(page).getByLabel(/^Annual rent/)).toBeVisible();
  await expect(panel(page).getByLabel(/^Occupancy/)).toBeVisible();
  await expect(panel(page).getByLabel(/^Collection loss/)).toHaveCount(0);
  await expect(panel(page).getByLabel(/^Lease basis/)).toHaveCount(0);
  await useUnderwritingMode(page, "Advanced Underwriting");
  for (const label of [/^Lease basis/, /^Rent normalization note/, /^Collection loss/, /^Concessions/, /^Total operating expenses/, /^Assumptions/])
    await expect(panel(page).getByLabel(label)).toBeVisible();
  for (const section of ["Lease economics", "Occupancy and collections", "Operating expenses", "Capital expenditure and conversion", "Soft costs and contingency", "Additional assumptions"])
    await expect(panel(page).locator(`[data-section="${section}"]`)).toBeVisible();
});

test("values entered in either view are kept in the other and sent exactly", async ({ page }) => {
  const { compareRequests } = await open(page);
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await panel(page).getByLabel(/^Annual rent/).fill("12.50");
  await panel(page).getByLabel(/^Occupancy/).fill("92.5");
  const before = await revision(page).textContent();

  await useUnderwritingMode(page, "Advanced Underwriting");
  // Switching the view is not an edit: the same scenario, values and revision.
  await expect(page.getByRole("tab", { name: /Alternative A/ })).toHaveAttribute("aria-selected", "true");
  await expect(revision(page)).toHaveText(before!);
  await expect(panel(page).getByLabel(/^Annual rent/)).toHaveValue("12.50");
  await expect(panel(page).getByLabel(/^Occupancy/)).toHaveValue("92.5");
  await panel(page).getByLabel(/^Collection loss/).fill("2");
  await panel(page).getByLabel(/^Renovation/).fill("250000");

  await useUnderwritingMode(page, "Quick Analysis");
  await expect(panel(page).getByLabel(/^Annual rent/)).toHaveValue("12.50");
  await expect(panel(page).getByLabel(/^Occupancy/)).toHaveValue("92.5");
  await expect(panel(page).getByLabel(/^Renovation cost/)).toHaveValue("250000");
  // The value Quick Analysis has no control for is still in view, read-only.
  const ledger = page.getByTestId("assumption-ledger");
  await ledger.locator("summary").click();
  await expect(ledger).toContainText("Collection loss");
  await expect(ledger).toContainText("2%");

  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByTestId("comparison-result")).toBeVisible();
  const body = ComparisonRequest.parse(compareRequests[0]);
  expect(body.scenarios[1].annualRentPerSqft).toEqual({ value: "12.50" });
  expect(body.scenarios[1].occupancyRatio).toEqual({ value: "0.925" });
  expect(body.scenarios[1].collectionLossRatio).toEqual({ value: "0.02" });
  expect(body.scenarios[1].capex.renovation).toEqual({ value: "250000" });
  // Nothing was filled in for the user.
  expect(body.scenarios[1].annualConcessions.value).toBeNull();
  expect(body.scenarios[2].annualRentPerSqft.value).toBeNull();
});

test("switching views makes no request and does not stale a current result", async ({ page }) => {
  const state = await open(page);
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByTestId("comparison-result")).toBeVisible();
  await openStage(page, "Underwriting");
  const calls = state.calls();
  await useUnderwritingMode(page, "Advanced Underwriting");
  await useUnderwritingMode(page, "Quick Analysis");
  await useUnderwritingMode(page, "Advanced Underwriting");
  expect(state.calls()).toBe(calls);
  await expect(page.getByTestId("stage-status-comparison")).toHaveText("Current");
  await expect(page.getByTestId("stage-status-investigation")).toHaveText("Not run");
});

test("an invalid percentage is reported in both views and blocks the request", async ({ page }) => {
  const { compareRequests } = await open(page);
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await panel(page).getByLabel(/^Occupancy/).fill("150");
  await expect(page.getByRole("tab", { name: /Alternative A/ })).toContainText("1 problems");
  await useUnderwritingMode(page, "Advanced Underwriting");
  await expect(panel(page).getByLabel(/^Occupancy/)).toHaveValue("150");
  await expect(panel(page).getByLabel(/^Occupancy/)).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByTestId("validation-summary")).toContainText("request was not sent");
  expect(compareRequests).toHaveLength(0);
});

test("the illustrative example asks before replacing edits made in Quick Analysis", async ({ page }) => {
  // The example needs a recorded (source) rentable area; the base fixture only has an estimate.
  const recorded = structuredClone(property);
  recorded.evidence[0].kind = "record";
  recorded.rentableAreaSqft.origin = "source_data";
  await open(page, recorded);
  await panel(page).getByLabel(/^Annual rent/).fill("21");
  await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
  await expect(page.getByTestId("illustrative-confirm")).toBeVisible();
  await page.getByRole("button", { name: "Keep my drafts" }).click();
  await expect(panel(page).getByLabel(/^Annual rent/)).toHaveValue("21");
  await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
  await page.getByRole("button", { name: "Replace drafts" }).click();
  // Loaded once, as one edit; occupancy 0.85 reads as 85 in Quick Analysis.
  await expect(panel(page).getByLabel(/^Annual rent/)).toHaveValue("14");
  await expect(panel(page).getByLabel(/^Occupancy/)).toHaveValue("85");
  await expect(page.getByTestId("readiness-complete")).toBeVisible();
});

test("without a recorded area the example explains why and leaves drafts alone", async ({ page }) => {
  await open(page);
  await panel(page).getByLabel(/^Annual rent/).fill("21");
  await page.getByRole("button", { name: "Load illustrative investment example", exact: true }).click();
  await expect(page.getByTestId("illustrative-error")).toContainText("Your current drafts are unchanged");
  await expect(panel(page).getByLabel(/^Annual rent/)).toHaveValue("21");
});
