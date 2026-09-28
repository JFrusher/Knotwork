import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/*
 * The Checklist is the crew's jobs with no block: what to have done before the
 * day. A task is added, dated, ticked off; and a task nobody is named on is
 * the couple's own — not a gap Delegation or What is left should call out.
 */
test("a task is added, dated and ticked off, and Delegation still counts only the day's jobs", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/checklist");

  const add = page.getByRole("form", { name: "Add a task" });
  await add.getByLabel("Task").fill("Book the cake tasting");
  await add.getByLabel("Done by").fill("2028-02-01");
  await add.getByRole("button", { name: "Add" }).click();

  const later = page.getByRole("region", { name: "Later" });
  await expect(later.getByRole("textbox", { name: "Task" }).and(page.locator('[value="Book the cake tasting"]'))).toBeVisible();
  // Ticked, it moves to Done — so a click, not a check that waits on the row it left.
  await later.getByRole("checkbox", { name: "Book the cake tasting: done" }).click();
  await expect(later.getByRole("checkbox", { name: "Book the cake tasting: done" })).toHaveCount(0);
  await page.getByText("Done (8)").click();
  await expect(page.getByRole("checkbox", { name: "Book the cake tasting: done" })).toBeChecked();

  await page.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: "Delegation" }).click();
  await expect(page.getByText("9 jobs, all covered")).toBeVisible();
});

test("the usual tasks come dated back from the day, and only once", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/checklist");
  // The example already has them all.
  await expect(page.getByRole("button", { name: "Add the usual tasks" })).toHaveCount(0);

  await page.getByRole("button", { name: "Remove “Order the cake”" }).click();
  await page.getByRole("button", { name: "Add the usual tasks" }).click();
  await expect(page.getByRole("checkbox", { name: "Order the cake: done" })).toHaveCount(1);
  await expect(page.getByLabel("Order the cake: done by")).toHaveValue("2028-02-02");
});
