import { expect, test, type Page } from "@playwright/test";
import { AnalysisRequest, CatalogResponse } from "@/lib/contracts";
import { answeringRevision } from "./helpers/revision";
import { prepareValidScenarios } from "./helpers/scenario";
import { analysis, errors, needsInput, property, propertyId, spatial, success } from "../tests/fixtures/contracts";

// Synthetic fixtures injected at the network boundary only. The analysis
// route is Codex's S11; these specs exercise the frozen contract.
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

async function mock(page: Page, body: unknown = success(analysis), status = 200) {
  const requests: unknown[] = [];
  await page.route("**/api/v1/properties", (r) => r.fulfill({ json: success(catalog) }));
  await page.route(`**/api/v1/properties/${propertyId}`, (r) => r.fulfill({ json: success(property) }));
  await page.route(`**/api/v1/properties/${propertyId}/spatial`, (r) => r.fulfill({ json: success(spatial) }));
  await page.route("**/api/v1/analysis", async (r) => {
    const sent = r.request().postDataJSON();
    requests.push(sent);
    await r.fulfill({ status, json: answeringRevision(body, sent) });
  });
  return requests;
}

async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("list", { name: "Properties" }).getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: "Analysis" })).toBeVisible();
  await prepareValidScenarios(page);
}

const action = (page: Page, name: string) =>
  page.getByRole("group", { name: "Analysis actions" }).getByRole("button", { name });

test("each action needs no typed prompt and sends the editor scenarios", async ({ page }) => {
  const requests = await mock(page);
  await open(page);
  await action(page, "Risks").click();
  await expect(page.getByTestId("analysis-complete")).toBeVisible();
  const body = AnalysisRequest.parse(requests[0]);
  expect(body.action).toBe("risks");
  expect(body.scenarios).toHaveLength(3);
  expect(body.propertyId).toBe(propertyId);
  expect("question" in body).toBe(false);
  await expect(page.getByText("Action: Risks")).toBeVisible();
});

test("the optional question is sent and trimmed", async ({ page }) => {
  const requests = await mock(page);
  await open(page);
  await page.getByLabel(/Question for the analyst/).fill("  Why not the baseline? ");
  await action(page, "Explain").click();
  await expect(page.getByTestId("analysis-complete")).toBeVisible();
  const body = AnalysisRequest.parse(requests[0]);
  expect(body.action).toBe("explain");
  expect(body.question).toBe("Why not the baseline?");
});

test("completed tools and evidence are shown after the response; facts and uncertainty are separated", async ({ page }) => {
  await mock(page);
  await open(page);
  await action(page, "Summary").click();
  await expect(page.getByTestId("investment-summary")).toBeVisible();
  await expect(page.getByText(/Tools completed:/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Supporting evidence" }).first()).toBeVisible();
});

test("an invalid editor blocks every action and nothing is sent", async ({ page }) => {
  const requests = await mock(page);
  await open(page);
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await page.getByLabel(/^Annual rent/).fill("12,5");
  await expect(action(page, "Analyze")).toBeDisabled();
  await expect(action(page, "Summary")).toBeDisabled();
  await expect(page.getByTestId("action-blocked")).toContainText("Fix 1 problem");
  expect(requests).toHaveLength(0);
});

test("editing inputs marks the old report stale and hides its summary", async ({ page }) => {
  await mock(page);
  await open(page);
  await action(page, "Analyze").click();
  await expect(page.getByTestId("investment-summary")).toBeVisible();
  await page.getByRole("tab", { name: /Alternative B/ }).click();
  await page.getByLabel(/^Annual rent/).fill("20");
  await expect(page.getByText(/Inputs changed after this analysis ran/)).toBeVisible();
  await expect(page.getByTestId("investment-summary")).toHaveCount(0);
});

test("needs_input is not shown as success and drafts are preserved for resubmission", async ({ page }) => {
  await mock(page, success(needsInput));
  await open(page);
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await page.getByLabel(/^Annual rent/).fill("12.50");
  await action(page, "Analyze").click();
  await expect(page.getByTestId("analysis-needs-input")).toBeVisible();
  await expect(page.getByTestId("investment-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit scenario inputs" }).click();
  await expect(page.getByRole("heading", { name: "Scenarios" })).toBeFocused();
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await expect(page.getByLabel(/^Annual rent/)).toHaveValue("12.50");
});

test("unavailable AI says the deterministic comparison still works, and retry recovers", async ({ page }) => {
  let n = 0;
  await mock(page);
  await page.route("**/api/v1/analysis", (r) => {
    n += 1;
    return n === 1
      ? r.fulfill({ status: 503, json: errors.ANALYSIS_UNAVAILABLE })
      : r.fulfill({ json: answeringRevision(success(analysis), r.request().postDataJSON()) });
  });
  await open(page);
  await action(page, "Analyze").click();
  await expect(page.getByTestId("ai-unavailable")).toBeVisible();
  const retry = page.getByRole("button", { name: "Try again" });
  if (await retry.count()) {
    await retry.click();
    await expect(page.getByTestId("analysis-complete")).toBeVisible();
  }
});

test("an analysis answering a different input revision is rejected, not shown", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/analysis", (r) =>
    r.fulfill({ json: answeringRevision(success(analysis), r.request().postDataJSON(), 7) }),
  );
  await open(page);
  await action(page, "Analyze").click();
  await expect(page.getByRole("region", { name: "Analysis", exact: true }).getByRole("alert")).toContainText("invalid response");
  await expect(page.getByTestId("analysis-complete")).toHaveCount(0);
});

test("a slow request shows loading with cancel and no invented progress stages", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/analysis", async (r) => {
    await new Promise((res) => setTimeout(res, 1500));
    await r
      .fulfill({ json: answeringRevision(success(analysis), r.request().postDataJSON()) })
      .catch(() => {});
  });
  await open(page);
  await action(page, "Analyze").click();
  await expect(page.getByRole("status").filter({ hasText: /Running analyze/i })).toBeVisible();
  await page.getByRole("button", { name: /Cancel/ }).click();
  await expect(page.getByText("No analysis has been run yet.")).toBeVisible();
});
