import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

/*
 * The Bar keeps only what the couple chose: the amounts are worked out from
 * the guest list every time, and a figure put back is forgotten.
 */
const row = (page: Parameters<typeof storedDocument>[0], drink: string) =>
  page.getByRole("table", { name: "What to buy" }).getByRole("row").filter({ has: page.getByRole("cell", { name: drink, exact: true }) });

test("the example wedding's drinks come to whole cases, and its priced lines to an estimate", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/bar");
  // 100 coming and 30 for the evening, a fifth of them not drinking.
  await expect(page.getByText("104 drinking alcohol, 26 on soft drinks")).toBeVisible();
  await expect(row(page, "Fizz")).toContainText("42 bottles7 cases of 6");
  await expect(row(page, "Beer and cider")).toContainText("240 bottles or cans10 cases of 24");
  // Two bottles of spirits in the cupboard: one more to buy.
  await expect(row(page, "Spirits")).toContainText("1 70cl bottle");
  await expect(page.getByText("About 1,206 for what has a price; 4 to buy with no price yet.")).toBeVisible();
});

test("a figure changed is kept, shows what it usually is, and goes back in one click", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/bar");
  const hours = page.getByRole("spinbutton", { name: "Hours of the evening bar" });
  await hours.fill("5");
  await hours.press("Enter");
  await expect.poll(async () => (await storedDocument(page)).bar?.figures?.eveningHours).toBe(5);
  await expect(page.getByText("5 each in the evening")).toBeVisible();

  await page.getByRole("button", { name: "Put hours of the evening bar back to 4" }).click();
  await expect.poll(async () => (await storedDocument(page)).bar?.figures?.eveningHours).toBeUndefined();
  await expect(hours).toHaveValue("4");

  await page.getByRole("button", { name: "Undo putting a figure back" }).click();
  await expect(hours).toHaveValue("5");
});

test("a new wedding adds the Bar from Tools and buys for the number typed", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Tools" });
  await tabs.getByRole("button", { name: "Add or remove tools" }).click();
  await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Add Bar" }).click();
  await page.keyboard.press("Escape");
  await tabs.getByRole("link", { name: "Bar" }).click();

  await expect(page.getByText("Nobody to buy for yet.")).toBeVisible();
  const coming = page.getByRole("spinbutton", { name: "How many are coming" });
  await coming.fill("100");
  await coming.press("Enter");
  await expect(page.getByText("Typed: the guest list has 0.")).toBeVisible();
  // The agreed defaults, for 100.
  await expect(row(page, "Fizz")).toContainText("42 bottles");
  await expect(row(page, "Ice")).toContainText("100 kilos");

  await page.getByRole("combobox", { name: "What kind of bar" }).selectOption({ label: "No and low" });
  await expect(row(page, "Alcohol-free fizz")).toContainText("42 bottles");
  await expect(row(page, "Alcohol-free spirits")).toContainText("—");
});

test("the drinks print as a shopping list, download as CSV, and join the pack only while the Bar is shown", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/bar");
  const save = async (button: string) => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button, exact: true }).click()]);
    return download;
  };
  expect((await save("Shopping list")).suggestedFilename()).toBe("alex-and-sam-drinks.pdf");
  const csv = await save("CSV");
  expect(csv.suggestedFilename()).toBe("alex-and-sam-drinks.csv");
  expect(readFileSync(await csv.path(), "utf8")).toContain("Wine merchant,Fizz,42 bottles,7 cases of 6,8.50,357.00");

  await page.goto("/");
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download the pack" }).click()]);
  await expect(page.getByText(/The boxes \(\d+\), The drinks \(1\)/)).toBeVisible();

  await page.goto("/?panel=tools");
  await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Remove Bar" }).click();
  await page.keyboard.press("Escape");
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download the pack" }).click()]);
  await expect(page.getByText(/The boxes \(\d+\), The shots/)).toBeVisible();
});

test("the reception's hours can be read from the Timeline's block, instead of typed twice", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/bar");
  const each = page.getByText(/each at the reception$/);
  const before = await each.textContent();
  await page.getByRole("combobox", { name: "Hours of the reception from" }).selectOption("blk-drinks");
  await expect(page.getByRole("status").filter({ hasText: "1h 15m at the reception, from the Timeline." })).toBeVisible();
  await expect(each).not.toHaveText(before ?? "");
});
