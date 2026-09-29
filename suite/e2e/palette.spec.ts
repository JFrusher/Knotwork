import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/*
 * Anything in the wedding, by name, from anywhere: each opens where it lives,
 * on the record itself — including in the tool already on screen.
 */
async function find(page: Page, text: string) {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Find anything" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill(text);
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
}

test("a table, another table, a job and a guest, each opened where it lives", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/");
  // Running, not just drawn: a key pressed before the page is live goes nowhere.
  await expect(page.getByRole("region", { name: "Next" })).toBeVisible();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Find anything" });
  await palette.getByRole("combobox").fill("table 1");
  // The best match first, and the keyboard moves through the rest.
  const options = palette.getByRole("option");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  expect((await new AxeBuilder({ page }).include("dialog[open]").analyze()).violations).toEqual([]);
  await palette.getByRole("combobox").fill("table 13");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/seating$/);
  await expect(page.getByLabel("Table name")).toHaveValue("Table 13");

  // Already on Seating: the palette selects there too.
  await find(page, "table 12");
  await expect(page.getByLabel("Table name")).toHaveValue("Table 12");

  await find(page, "lay the tables");
  await expect(page).toHaveURL(/\/delegation$/);
  await expect(page.getByRole("textbox", { name: "Job", exact: true })).toHaveValue("Lay the tables");

  await find(page, "zainab thist");
  await expect(page).toHaveURL(/\/guests$/);
  await expect(page.getByRole("searchbox")).toHaveValue("Zainab Thistlewood");
  await expect(page.getByRole("table").getByRole("rowheader")).toHaveText(["Zainab Thistlewood"]);
});

test("the header's search button opens it too", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Find anything" }).click();
  await expect(page.getByRole("dialog", { name: "Find anything" })).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(11);
});
