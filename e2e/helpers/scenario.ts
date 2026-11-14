import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Uses the real editor to supply the only inputs the app requires before it
 * will send a request: a proposed use for every scenario. Financial fields are
 * deliberately left blank (sent as unknown), and no estimate is accepted; the
 * product never fills these in for the user.
 *
 * Each step waits for the clicked tab to be selected and its own panel to be
 * showing before touching the field, and confirms the value stuck before
 * moving on, so a re-render can never send text to the previous scenario.
 */
const USES = ["Self storage", "Light industrial", "Medical office", "Creative studios", "Flex retail"];

async function showScenario(page: Page, tab: Locator) {
  const tabId = await tab.getAttribute("id");
  if (!tabId?.startsWith("tab-")) throw new Error(`Unexpected scenario tab id: ${tabId}`);
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const panel = page.locator(`#panel-${tabId.slice("tab-".length)}`);
  await expect(panel).toBeVisible();
  const use = panel.getByLabel(/^Proposed use/);
  await expect(use).toBeVisible();
  return use;
}

export async function prepareValidScenarios(page: Page) {
  const tabs = page.getByRole("tab");
  // The editor mounts only once the property has loaded. Callers may arrive
  // straight after clicking a property, so wait for the baseline and both
  // alternatives to exist before counting; counting early reads 0 and skips
  // the loop, leaving every alternative without a proposed use.
  await expect(tabs.nth(2)).toBeVisible();
  const n = await tabs.count();
  let alt = 0;
  for (let i = 0; i < n; i += 1) {
    const use = await showScenario(page, tabs.nth(i));
    if ((await use.inputValue()).trim() === "") {
      const text = USES[alt % USES.length];
      alt += 1;
      await use.fill(text);
      await expect(use).toHaveValue(text);
    }
    await expect(use).not.toHaveValue("");
  }
  // Revisit every scenario: each value must have survived switching tabs.
  for (let i = 0; i < n; i += 1) {
    const use = await showScenario(page, tabs.nth(i));
    await expect(use).not.toHaveValue("");
  }
  const first = tabs.first();
  await first.click();
  await expect(first).toHaveAttribute("aria-selected", "true");
  // No scenario tab may still report problems.
  await expect(page.getByRole("tab").filter({ hasText: /problems?/ })).toHaveCount(0);
}
