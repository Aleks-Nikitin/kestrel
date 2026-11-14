import { expect, type Page } from "@playwright/test";

/**
 * Uses the real editor to supply the only inputs the app requires before it
 * will send a request: a proposed use for every scenario. Financial fields are
 * deliberately left blank (sent as unknown), and no estimate is accepted; the
 * product never fills these in for the user.
 */
const USES = ["Self storage", "Light industrial", "Medical office", "Creative studios", "Flex retail"];

export async function prepareValidScenarios(page: Page) {
  const tabs = page.getByRole("tab");
  const n = await tabs.count();
  let alt = 0;
  for (let i = 0; i < n; i += 1) {
    await tabs.nth(i).click();
    const use = page.getByLabel(/^Proposed use/);
    if (((await use.inputValue()) ?? "").trim() === "") {
      await use.fill(USES[alt % USES.length]);
      alt += 1;
    }
  }
  await tabs.first().click();
  // No scenario tab may still report problems.
  await expect(page.getByRole("tab").filter({ hasText: /problems?/ })).toHaveCount(0);
}
