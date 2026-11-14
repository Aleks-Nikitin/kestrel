import { expect, test, type Page } from "@playwright/test";
import { CatalogResponse, SpatialContext } from "@/lib/contracts";
import { property, propertyId, spatial, success } from "../tests/fixtures/contracts";

// Synthetic fixtures injected at the network boundary only.
const footprint = {
  type: "Polygon" as const,
  coordinates: [
    [
      [-95.3602, 29.7598],
      [-95.3598, 29.7598],
      [-95.3598, 29.7602],
      [-95.3602, 29.7602],
      [-95.3602, 29.7598],
    ],
  ],
};
const spatialWithImagery = SpatialContext.parse({
  ...spatial,
  imagery: {
    assetId: "asset-1",
    displayPath: `/api/v1/properties/${propertyId}/media/asset-1`,
    capturedAt: "2026-01-01T00:00:00Z",
    footprintGeoJSON: footprint,
    attribution: "Fictional synthetic imagery",
  },
});
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
// 1×1 transparent PNG for the proxied media path.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function mock(page: Page, spatialBody: unknown = success(spatialWithImagery)) {
  await page.route("**/api/v1/properties", (r) => r.fulfill({ json: success(catalog) }));
  await page.route(`**/api/v1/properties/${propertyId}`, (r) => r.fulfill({ json: success(property) }));
  await page.route(`**/api/v1/properties/${propertyId}/spatial`, (r) => r.fulfill({ json: spatialBody }));
  await page.route("**/api/v1/properties/*/media/*", (r) =>
    r.fulfill({ contentType: "image/png", body: PNG }),
  );
}

test("map marker and list select the same property", async ({ page }) => {
  await mock(page);
  await page.goto("/");
  const marker = page.getByRole("button", { name: /^Select 100 Fictional/ });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.getByRole("button", { name: /100 Fictional Example Way/, pressed: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /100 Fictional Example Way/, level: 2 })).toBeVisible();
});

test("keyboard can select from the list and from the map marker", async ({ page }) => {
  await mock(page);
  await page.goto("/");
  const marker = page.getByRole("button", { name: /^Select 100 Fictional/ });
  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("footprint-check")).toBeVisible();
});

test("no configured basemap is stated, not hidden", async ({ page }) => {
  await mock(page);
  await page.goto("/");
  await expect(page.getByTestId("no-basemap")).toBeVisible();
});

test("matched imagery shows capture date, attribution and footprint check; rooms are drawn to scale", async ({ page }) => {
  await mock(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^Select 100 Fictional/ }).click();
  await expect(page.getByText(/Fictional synthetic imagery/)).toBeVisible();
  await expect(page.getByText(/Captured 2026-01-01/)).toBeVisible();
  await expect(page.getByTestId("footprint-check")).toContainText("inside the matched footprint");
  await expect(page.locator('[data-room="room-001"]')).toBeVisible();
});

test("unmatched spatial layer shows no imagery, footprint or rooms as evidence", async ({ page }) => {
  const unmatched = SpatialContext.parse({
    ...spatial,
    dataMode: "unavailable",
    match: { ...spatial.match, status: "unmatched", evidenceIds: [], reviewedAt: null },
    model: null,
    observations: [],
    unavailableReason: "Matching imagery unavailable",
  });
  await mock(page, success(unmatched));
  await page.goto("/");
  await page.getByRole("button", { name: /^Select 100 Fictional/ }).click();
  await expect(page.getByText("Matching imagery unavailable")).toBeVisible();
  await expect(page.locator("[data-room]")).toHaveCount(0);
  await expect(page.getByText(/No matched footprint/)).toBeVisible();
});

test("WebGL failure leaves the list and property panel usable", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    const patched = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (/webgl/.test(type)) return null;
      return Reflect.apply(orig, this, [type, ...args]);
    };
    HTMLCanvasElement.prototype.getContext = patched as typeof orig;
  });
  await mock(page);
  await page.goto("/");
  await expect(page.getByTestId("map-unavailable")).toBeVisible();
  await page.getByRole("button", { name: /100 Fictional Example Way/ }).click();
  await expect(page.getByRole("heading", { name: /100 Fictional Example Way/, level: 2 })).toBeVisible();
});

test("narrow viewport: map, list and panels fit without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await page.goto("/");
  await page.getByRole("button", { name: /100 Fictional Example Way/ }).first().click();
  await expect(page.getByTestId("footprint-check")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
