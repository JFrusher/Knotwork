import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

/*
 * The drinks calculator is for people with no wedding in Knotwork: the Bar's
 * own sums, kept nowhere, and a way to carry them into a wedding if they want.
 */
const row = (page: Parameters<typeof storedDocument>[0], drink: string) =>
  page.getByRole("table", { name: "What to buy" }).getByRole("row").filter({ has: page.getByRole("cell", { name: drink, exact: true }) });

test("works out the drinks for 100 with the Bar's defaults, and keeps nothing", async ({ page }) => {
  await page.goto("/calculators/drinks");
  await expect(page.getByRole("heading", { level: 1, name: "Wedding drinks calculator" })).toBeVisible();
  await expect(row(page, "Fizz")).toContainText("42 bottles7 cases of 6");

  const coming = page.getByRole("spinbutton", { name: "How many are coming" });
  await coming.fill("50");
  await coming.press("Enter");
  await expect(row(page, "Fizz")).toContainText("24 bottles4 cases of 6");

  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);

  await page.getByRole("link", { name: "How the numbers are worked out" }).click();
  await expect(page).toHaveURL(/\/blog\/how-much-drink-for-a-uk-wedding$/);
});

test("is in the sitemap", async ({ request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/calculators/drinks</loc>");
});

test("carries its settings into a wedding's Bar only when asked, keeping the wedding's head count", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/calculators/drinks");
  await page.getByRole("spinbutton", { name: "Hours of the evening bar" }).fill("6");
  await page.getByRole("spinbutton", { name: "Hours of the evening bar" }).press("Enter");
  await page.getByRole("link", { name: "Use these figures in your own wedding’s Bar" }).click();

  await expect(page).toHaveURL(/\/bar$/);
  await page.getByRole("button", { name: "Use them" }).click();
  await expect.poll(async () => (await storedDocument(page)).bar?.figures?.eveningHours).toBe(6);
  await expect(page.getByText("104 drinking alcohol, 26 on soft drinks")).toBeVisible();
});
