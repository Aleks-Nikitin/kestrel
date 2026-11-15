import { expect, test, type Page } from "@playwright/test";
import { CatalogResponse, ComparisonRequest } from "@/lib/contracts";
import { answeringRevision } from "./helpers/revision";
import { prepareValidScenarios } from "./helpers/scenario";
import { openStage, useUnderwritingMode } from "./helpers/stage";
import { comparison, errors, property, propertyId, spatial, success } from "../tests/fixtures/contracts";

// Synthetic fixtures injected at the network boundary only; the compare route
// (Codex S10) is mocked until the real endpoint is integrated.
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

async function mock(page: Page, compareBody: unknown = success(comparison), status = 200) {
  const requests: unknown[] = [];
  await page.route("**/api/v1/properties", (r) => r.fulfill({ json: success(catalog) }));
  await page.route(`**/api/v1/properties/${propertyId}`, (r) => r.fulfill({ json: success(property) }));
  await page.route(`**/api/v1/properties/${propertyId}/spatial`, (r) => r.fulfill({ json: success(spatial) }));
  await page.route("**/api/v1/scenarios/compare", async (r) => {
    const sent = r.request().postDataJSON();
    requests.push(sent);
    await r.fulfill({ status, json: answeringRevision(compareBody, sent) });
  });
  return requests;
}

async function openEditor(page: Page) {
  await page.goto("/");
  // Scope to the list: map markers share the property's accessible name.
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  await prepareValidScenarios(page);
  await expect(page.getByRole("heading", { name: "Underwriting", level: 2 })).toBeVisible();
}

test("calculates a comparison from valid drafts and shows backend values only", async ({ page }) => {
  const requests = await mock(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByText(/Why \(from the deterministic comparison\)/)).toBeVisible();
  expect(requests).toHaveLength(1);
  const body = ComparisonRequest.parse(requests[0]);
  expect(body.scenarios).toHaveLength(3);
  expect(body.propertyId).toBe(propertyId);
  expect(body.scenarios.map((x) => x.proposedUse)).toEqual(["Office", "Self storage", "Light industrial"]);
  expect(body.scenarios[0].capex.renovation.value).toBe("0"); // baseline investment is zero by contract
  expect(body.scenarios[1].capex.renovation.value).toBeNull(); // unknown stays unknown
  const preferred = page.locator('[data-preferred="true"]');
  await expect(preferred).toHaveCount(1);
  await expect(preferred).toContainText("Preferred");
});

test("unknown fields stay unknown in the request", async ({ page }) => {
  const requests = await mock(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByText(/Why \(from the deterministic comparison\)/)).toBeVisible();
  const body = ComparisonRequest.parse(requests[0]);
  expect(body.scenarios[1].otherEffectiveAnnualIncome.value).toBeNull();
  expect(body.scenarios[1].occupancyRatio.value).toBeNull();
});

test("an invalid field blocks the request and is marked on its tab", async ({ page }) => {
  const requests = await mock(page);
  await openEditor(page);
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await page.getByLabel(/^Annual rent/).fill("12,5");
  await expect(page.getByRole("tab", { name: /Alternative A/ })).toContainText("1 problems");
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByTestId("validation-summary")).toContainText("request was not sent");
  expect(requests).toHaveLength(0);
});

test("typed decimals are sent exactly as entered", async ({ page }) => {
  const requests = await mock(page);
  await openEditor(page);
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await page.getByLabel(/^Annual rent/).fill("12.50");
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByText(/Why \(from the deterministic comparison\)/)).toBeVisible();
  const body = ComparisonRequest.parse(requests[0]);
  expect(body.scenarios[1].annualRentPerSqft).toEqual({ value: "12.50" });
});

test("explicit 'no other income modeled' sends zero with a note", async ({ page }) => {
  const requests = await mock(page);
  await openEditor(page);
  await useUnderwritingMode(page, "Advanced Underwriting");
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await page.getByLabel(/No other income modeled/).check();
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByText(/Why \(from the deterministic comparison\)/)).toBeVisible();
  const body = ComparisonRequest.parse(requests[0]);
  expect(body.scenarios[1].otherEffectiveAnnualIncome.value).toBe("0");
});

test("editing after a result marks it stale", async ({ page }) => {
  await mock(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByText(/Why \(from the deterministic comparison\)/)).toBeVisible();
  await openStage(page, "Underwriting");
  await page.getByRole("tab", { name: /Alternative B/ }).click();
  await page.getByLabel(/^Annual rent/).fill("20");
  await expect(page.getByTestId("stage-status-comparison")).toHaveText("Out of date");
  await openStage(page, "Comparison");
  await expect(page.getByTestId("comparison-result").getByText(/out of date/i)).toBeVisible();
});

test("alternatives can be added but never fewer than two", async ({ page }) => {
  await mock(page);
  await openEditor(page);
  await useUnderwritingMode(page, "Advanced Underwriting");
  await page.getByRole("button", { name: "Add alternative" }).click();
  await expect(page.getByRole("tab", { name: /Alternative C/ })).toBeVisible();
  await page.getByRole("tab", { name: /Alternative C/ }).click();
  await page.getByRole("button", { name: /Remove/ }).click();
  await expect(page.getByRole("tab", { name: /Alternative C/ })).toHaveCount(0);
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await expect(page.getByRole("button", { name: /Remove/ })).toHaveCount(0);
});

test("a retryable server error is shown with a retry that recovers", async ({ page }) => {
  let n = 0;
  await mock(page);
  await page.route("**/api/v1/scenarios/compare", (r) => {
    n += 1;
    return n === 1
      ? r.fulfill({ status: 504, json: errors.TIMEOUT })
      : r.fulfill({ json: answeringRevision(success(comparison), r.request().postDataJSON()) });
  });
  await openEditor(page);
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  await expect(page.getByRole("region", { name: "Comparison", exact: true }).getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: /Try again/ }).click();
  await expect(page.getByText(/Why \(from the deterministic comparison\)/)).toBeVisible();
});

test("a response for a different input revision is rejected, not shown", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/scenarios/compare", (r) =>
    r.fulfill({ json: answeringRevision(success(comparison), r.request().postDataJSON(), 7) }),
  );
  await openEditor(page);
  await page.getByRole("button", { name: "Calculate comparison" }).click();
  const section = page.getByRole("region", { name: "Comparison", exact: true });
  await expect(section.getByRole("alert")).toContainText("invalid response");
  await expect(page.getByTestId("comparison-result")).toHaveCount(0);
});

test("arrow keys move between scenario tabs", async ({ page }) => {
  await mock(page);
  await openEditor(page);
  await page.getByRole("tab", { name: /baseline/i }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Alternative A/ })).toBeFocused();
});
