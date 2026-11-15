import { expect, test, type Page } from "@playwright/test";
import { AnalysisRequest, CatalogResponse } from "@/lib/contracts";
import { answeringRevision } from "./helpers/revision";
import { prepareValidScenarios } from "./helpers/scenario";
import { openStage } from "./helpers/stage";
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
  await prepareValidScenarios(page);
  await openStage(page, "Investigation");
  await expect(page.getByRole("heading", { name: "Investigation", level: 2 })).toBeVisible();
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
  await expect(page.getByTestId("memo-focus")).toContainText("Focused view: Risks");
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
  // Plain-language activity by default; the real tool records are in the audit.
  await expect(page.getByTestId("memo-activity")).toContainText("Calculated the scenario comparison");
  await expect(page.getByTestId("memo-activity")).not.toContainText("runComparison");
  await page.getByTestId("technical-audit").locator("summary").first().click();
  await expect(page.getByTestId("tool-step").first()).toContainText("runComparison");
  await expect(page.getByRole("list", { name: "Supporting evidence" }).first()).toBeVisible();
});

test("an invalid editor blocks every action and nothing is sent", async ({ page }) => {
  const requests = await mock(page);
  await open(page);
  await openStage(page, "Underwriting");
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await page.getByLabel(/^Annual rent/).fill("12,5");
  await openStage(page, "Investigation");
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
  await openStage(page, "Underwriting");
  await page.getByRole("tab", { name: /Alternative B/ }).click();
  await page.getByLabel(/^Annual rent/).fill("20");
  await openStage(page, "Investigation");
  await expect(page.getByText(/Inputs changed after this analysis ran/)).toBeVisible();
  await expect(page.getByTestId("investment-summary")).toHaveCount(0);
});

test("needs_input is not shown as success and drafts are preserved for resubmission", async ({ page }) => {
  await mock(page, success(needsInput));
  await open(page);
  await openStage(page, "Underwriting");
  await page.getByRole("tab", { name: /Alternative A/ }).click();
  await page.getByLabel(/^Annual rent/).fill("12.50");
  await openStage(page, "Investigation");
  await action(page, "Analyze").click();
  await expect(page.getByTestId("analysis-needs-input")).toBeVisible();
  await expect(page.getByTestId("investment-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit scenario inputs" }).click();
  await expect(page.getByRole("heading", { name: "Underwriting", level: 2 })).toBeFocused();
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
  await expect(page.getByRole("region", { name: "Investigation", exact: true }).getByRole("alert")).toContainText("invalid response");
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

for (const [name, title] of [["Analyze", "Full analysis"], ["Compare", "Comparison"], ["Risks", "Risks"], ["Explain", "Explanation"], ["Summary", "Summary"]] as const)
  test(`${name} renders the memo from the returned payload with its own emphasis`, async ({ page }) => {
    const requests = await mock(page);
    await open(page);
    await action(page, name).click();
    const memo = page.getByTestId("investment-summary");
    await expect(memo).toBeVisible();
    expect(AnalysisRequest.parse(requests[0]).action).toBe(name.toLowerCase());
    await expect(page.getByTestId("memo-focus")).toContainText(`Focused view: ${title}`);
    // Same result for every action: decision, rounded figures, verification scope, sources.
    await expect(memo).toContainText("alternative-b");
    await expect(memo).toContainText("$195,000 / yr");
    await expect(memo).toContainText("$450,000");
    await expect(memo).toContainText("6 years");
    await expect(memo.getByTestId("memo-verification")).toContainText("No verification receipt for this run");
    await expect(memo.getByTestId("memo-verification")).toContainText("No per-statement verdict is reported");
    await expect(memo.getByTestId("memo-sources")).toContainText("Data sources: property synthetic, spatial synthetic");
    // No raw debug output in the investor view.
    await expect(memo).not.toContainText("synthetic-call");
    await expect(memo).not.toContainText("NOT_APPLICABLE");
    await expect(memo).not.toContainText("finance.v1");
    const first = await memo.locator("[data-memo-section]").nth(1).getAttribute("data-memo-section");
    expect(first).toBe({ Analyze: "memo-rationale", Compare: "memo-ranking", Risks: "memo-risks", Explain: "memo-rationale", Summary: "memo-risks" }[name]);
  });

test("a finding shared by every scenario is listed once and the audit expands without any request", async ({ page }) => {
  await mock(page);
  await open(page);
  await action(page, "Risks").click();
  const memo = page.getByTestId("investment-summary");
  await expect(memo).toBeVisible();
  await expect(memo.getByText("Synthetic; legal feasibility unverified")).toHaveCount(1);
  let calls = 0;
  page.on("request", (q) => {
    if (new URL(q.url()).pathname.startsWith("/api/")) calls += 1;
  });
  const audit = page.getByTestId("technical-audit");
  await audit.locator("summary").first().focus();
  await page.keyboard.press("Enter");
  await expect(audit.getByRole("region", { name: "Exact financial values" })).toBeVisible();
  await expect(audit).toContainText("finance.v1.");
  await expect(audit).toContainText("synthetic-call");
  await expect(audit).toContainText("Not reported for this run");
  expect(calls).toBe(0);
});

test("a stale analysis shows only that it needs updating", async ({ page }) => {
  await mock(page);
  await open(page);
  await action(page, "Analyze").click();
  await expect(page.getByTestId("investment-summary")).toBeVisible();
  await openStage(page, "Underwriting");
  await page.getByRole("tab", { name: /Alternative B/ }).click();
  await page.getByLabel(/^Annual rent/).fill("20");
  await openStage(page, "Investigation");
  await expect(page.getByTestId("analysis-stale")).toContainText("Analysis needs updating");
  for (const id of ["analysis-complete", "investment-summary", "memo-verification", "technical-audit", "investigation-panel"])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Investigation", exact: true })).not.toContainText("$195,000");
});
