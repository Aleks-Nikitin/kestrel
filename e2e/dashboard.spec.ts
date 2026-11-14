import { expect, test, type Page } from "@playwright/test";
import { CatalogResponse } from "@/lib/contracts";
import {
  analysis,
  errors,
  needsInput,
  property,
  propertyId,
  spatial,
  success,
} from "../tests/fixtures/contracts";

// Fixture responses are injected at the network boundary only; the app has no
// production fixture switch. Everything here is synthetic.
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

async function mockApi(
  page: Page,
  analysisBody: unknown = success(analysis),
  analysisStatus = 200,
) {
  await page.route("**/api/v1/properties", (r) =>
    r.fulfill({ json: success(catalog) }),
  );
  await page.route(`**/api/v1/properties/${propertyId}`, (r) =>
    r.fulfill({ json: success(property) }),
  );
  await page.route(`**/api/v1/properties/${propertyId}/spatial`, (r) =>
    r.fulfill({ json: success(spatial) }),
  );
  await page.route("**/api/v1/analysis", (r) =>
    r.fulfill({ status: analysisStatus, json: analysisBody }),
  );
}

test("synthetic data is labeled and selection shows facts, units and spatial evidence", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByTestId("synthetic-banner")).toBeVisible();
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: /100 Fictional Example Way/ }).click();
  await expect(
    page.getByRole("heading", { name: /100 Fictional Example Way/, level: 2 }),
  ).toBeFocused();
  await expect(page.getByText("10,000 sq ft").first()).toBeVisible();
  await expect(page.getByText("Unknown — not supplied").first()).toBeVisible();
  await expect(page.getByText("Width (m)")).toBeVisible();
  await expect(page.getByText(/Floor area \(m²\)/)).toBeVisible();
});

test("analysis result renders canonical values and stays labeled synthetic", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: /100 Fictional Example Way/ }).click();
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByTestId("analysis-complete")).toBeVisible();
  await expect(page.getByText("$195,000 / yr").first()).toBeVisible();
  await expect(page.getByText("Run data: Synthetic")).toBeVisible();
  await expect(page.getByTestId("investment-summary")).toBeVisible();
});

test("needs_input is shown as a non-recommendation", async ({ page }) => {
  await mockApi(page, success(needsInput));
  await page.goto("/");
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: /100 Fictional Example Way/ }).click();
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByTestId("analysis-needs-input")).toBeVisible();
  await expect(page.getByTestId("investment-summary")).toHaveCount(0);
});

test("retryable failures offer retry; non-retryable do not", async ({ page }) => {
  await mockApi(page, errors.TIMEOUT, 504);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: /100 Fictional Example Way/ }).click();
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByRole("region", { name: "Analysis", exact: true }).getByRole("alert")).toContainText("timed out");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await page.unroute("**/api/v1/analysis");
  await page.route("**/api/v1/analysis", (r) =>
    r.fulfill({ status: 403, json: errors.LICENSE_RESTRICTED }),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("region", { name: "Analysis", exact: true }).getByRole("alert")).toContainText("Restricted by data license");
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("narrow viewport has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: /100 Fictional Example Way/ }).click();
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByTestId("analysis-complete")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
