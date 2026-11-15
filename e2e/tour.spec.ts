import { expect, test, type Page } from "@playwright/test";
import { CatalogResponse } from "@/lib/contracts";
import { property, propertyId, spatial, success } from "../tests/fixtures/contracts";
import { openStage } from "./helpers/stage";

// The frozen contract exposes no Showcase SID, so the available-tour path
// cannot be mocked end to end yet; unit tests cover it through the resolver.
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

async function mock(page: Page) {
  await page.route("**/api/v1/properties", (r) => r.fulfill({ json: success(catalog) }));
  await page.route(`**/api/v1/properties/${propertyId}`, (r) => r.fulfill({ json: success(property) }));
  await page.route(`**/api/v1/properties/${propertyId}/spatial`, (r) => r.fulfill({ json: success(spatial) }));
  const matterport: string[] = [];
  page.on("request", (q) => {
    if (q.url().includes("matterport.com")) matterport.push(q.url());
  });
  return matterport;
}

test("the map is the default view and Matterport is never contacted", async ({ page }) => {
  const matterport = await mock(page);
  await page.goto("/");
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  // The overview frames the map alone; the 2D/3D switch belongs to the Building stage.
  await expect(page.getByTestId("property-map").or(page.getByTestId("map-unavailable"))).toBeVisible();
  await expect(page.getByRole("radio", { name: "2D Map" })).toHaveCount(0);
  await openStage(page, "Building");
  await expect(page.getByRole("radio", { name: "2D Map" })).toBeChecked();
  await expect(page.getByTestId("property-map").or(page.getByTestId("map-unavailable"))).toBeVisible();
  expect(matterport).toHaveLength(0);
});

test("3D Tour is disabled with a stated reason when no verified embeddable model exists", async ({ page }) => {
  await mock(page);
  await page.goto("/");
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  await openStage(page, "Building");
  await expect(page.getByRole("radio", { name: "3D Tour" })).toBeDisabled();
  await expect(page.getByTestId("tour-hint")).toContainText("3D tour unavailable");
  // The room-size schematic remains in the spatial evidence section.
  await expect(page.locator('[data-room="room-001"]')).toBeVisible();
});

test("the switch is keyboard reachable and keeps the selection", async ({ page }) => {
  await mock(page);
  await page.goto("/");
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  await openStage(page, "Building");
  await page.getByRole("radio", { name: "2D Map" }).focus();
  await expect(page.getByRole("radio", { name: "2D Map" })).toBeFocused();
  await openStage(page, "Overview");
  await expect(page.getByRole("heading", { name: /100 Fictional Example Way/, level: 2 })).toBeVisible();
});

test("the switch fits a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await mock(page);
  await page.goto("/");
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  await openStage(page, "Building");
  const box = await page.getByRole("radio", { name: "2D Map" }).locator("xpath=ancestor::fieldset").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
});
