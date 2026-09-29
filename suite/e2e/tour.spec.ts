import { expect, test } from "@playwright/test";
import { CHAPTERS } from "../lib/tour/steps";
import { seedExampleWedding } from "./wedding";

/*
 * "Take a tour" walks every chapter, on the example wedding, and every step
 * points at something that is really there — which is what the example is
 * for. A missing anchor would show a card pointing at nothing.
 */
test("Take a tour walks every chapter, and each step points at something real", async ({ page }) => {
  test.setTimeout(120_000);
  await seedExampleWedding(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Take (a|the) tour/ }).click();

  const steps = CHAPTERS.flatMap((chapter) => chapter.steps.map((step) => ({ chapter, step })));
  for (const [i, { chapter, step }] of steps.entries()) {
    const card = page.getByRole("dialog", { name: `${chapter.title}: ${step.title}` });
    await expect(card, `step ${i + 1}`).toBeVisible();
    await expect(card.getByText(`${i + 1} of ${steps.length}`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${step.route === "/" ? "/$" : step.route}$`));
    await expect(page.locator(`[data-tour="${step.anchor}"]`).first(), step.anchor).toBeAttached();
    await card.getByRole("button", { name: i === steps.length - 1 ? "Done" : "Next" }).click();
  }
  await expect(page.getByRole("dialog", { name: /: / })).toHaveCount(0);
});
