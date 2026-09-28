import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/*
 * Money is changed in one place, and what is changed there is what the rest of
 * the wedding reads: What is left, the front page, and Delegation, which keeps
 * the suppliers but no longer their costs.
 */
test("a balance paid, and a budget cut, show wherever money is counted", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/money");

  const totals = page.getByRole("region", { name: "In all" });
  await expect(totals).toContainText("Paid3,325");

  const toPay = page.getByRole("region", { name: "To pay" });
  const caterer = toPay.getByRole("listitem").filter({ hasText: "Granary Kitchen — balance" });
  await expect(caterer).toContainText("Due 18 May 2028");
  await expect(caterer).toContainText("7,400");
  await caterer.getByRole("button", { name: "Paid today" }).click();
  await expect(caterer).toHaveCount(0);
  await expect(totals).toContainText("Paid10,725");
  await expect(page.getByRole("row", { name: /Granary Kitchen/ }).getByLabel("Granary Kitchen: balance paid on")).not.toHaveValue("");

  await totals.getByLabel("Budget").fill("15000");
  await page.keyboard.press("Tab");
  await expect(totals).toContainText("865 over the budget");

  // Across the app, as a person would go: a full reload straight after an edit
  // races the write to this browser's storage, which is not what this is about.
  await page.getByRole("button", { name: /^Alex & Sam/ }).click();
  await page.getByRole("navigation", { name: "This wedding" }).getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("region", { name: "Where things stand" }).getByRole("link", { name: /Money\s*15,865 of 15,000/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Also left" })).toContainText("Committed 15,865 against a budget of 15,000.");

  await page.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: "Delegation" }).click();
  await expect(page.getByRole("spinbutton", { name: "Budget" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Money" })).toBeVisible();
});
