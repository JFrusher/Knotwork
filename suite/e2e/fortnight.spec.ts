import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/*
 * Two weeks out is when couples come back to print. The example's day is
 * 1 June 2028; the clock is held 13 days before it, then 15.
 */
test("thirteen days out, the front page says what to print, and every link opens it", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2028-05-19T10:00:00Z"));
  await seedExampleWedding(page);
  await page.goto("/");

  const card = page.getByRole("region", { name: "13 days to go" });
  await expect(card).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const links: Array<[string, RegExp]> = [
    ["Place cards", /\/stationery\?piece=place-cards$/],
    ["Table cards", /\/stationery\?piece=table-card$/],
    ["A job sheet for each person", /\/delegation$/],
    ["The shot list", /\/group-shots$/],
    ["Binder", /\/binder$/],
  ];
  for (const [name, url] of links) {
    await page.goto("/");
    await card.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
  }

  await page.goto("/");
  await card.getByRole("link", { name: /The wedding pack/ }).click();
  await expect(page).toHaveURL(/\/#wedding-pack$/);
  await expect(page.locator("#wedding-pack").getByRole("button")).toBeInViewport();
});

test("fifteen days out, it is not there yet", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2028-05-17T10:00:00Z"));
  await seedExampleWedding(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  await expect(page.getByRole("region", { name: /days to go/ })).toHaveCount(0);
});
