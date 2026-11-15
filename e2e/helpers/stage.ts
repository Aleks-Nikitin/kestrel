import { expect, type Page } from "@playwright/test";

export type Stage = "Overview" | "Building" | "Underwriting" | "Comparison" | "Investigation";

/**
 * Opens a workspace stage through the real workflow navigation and waits until
 * it is the current step. Stages past the overview exist only once a property
 * has loaded, so this also waits for that.
 */
export async function openStage(page: Page, stage: Stage) {
  const link = page.getByRole("navigation", { name: "Workflow" }).getByRole("link", { name: new RegExp(`^${stage}`) });
  await link.click();
  await expect(link).toHaveAttribute("aria-current", "step");
}
