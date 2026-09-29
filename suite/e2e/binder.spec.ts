import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/*
 * The Binder is for a phone, on the day, often without signal. The clock is
 * held at 13:45 at the venue — 12:45 UTC, an hour behind in June — so "now"
 * is the ceremony.
 */
test.use({ viewport: { width: 390, height: 844 } });

test("on the day: what is on now, a guest's table, a number to ring, a shot ticked off", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2028-06-01T12:45:00Z"));
  await seedExampleWedding(page);
  await page.goto("/binder");

  const now = page.getByRole("region", { name: "Now" });
  await expect(now).toContainText("13:45 at the venue");
  await expect(now.getByRole("listitem").first()).toContainText("Ceremony");
  await expect(now).toContainText("until 14:15");
  await expect(now.getByRole("listitem").nth(1)).toContainText(/14:15\s*Confetti/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const binder = page.getByRole("navigation", { name: "The Binder" });
  await binder.getByRole("button", { name: "Find" }).click();
  await page.getByRole("searchbox", { name: "A guest’s name" }).fill("zainab lind");
  await expect(page.getByRole("region", { name: "Find a guest" }).getByRole("listitem")).toHaveText([/Zainab Lindqvist\s*Table \d+/]);

  await binder.getByRole("button", { name: "Ring" }).click();
  await expect(page.getByRole("link", { name: "Ring Eleanor Vane Photography, 07700 900141" })).toHaveAttribute("href", "tel:07700900141");

  await binder.getByRole("button", { name: "Shots" }).click();
  const shots = page.getByRole("region", { name: "The shot list" });
  await expect(shots).toContainText("0 of 26 taken");
  await shots.getByRole("checkbox").first().check();
  await expect(shots).toContainText("1 of 26 taken");
  await page.reload();
  await page.getByRole("navigation", { name: "The Binder" }).getByRole("button", { name: "Shots" }).click();
  await expect(page.getByRole("region", { name: "The shot list" })).toContainText("1 of 26 taken");
});

test("with no signal, it opens from the copy on the phone", async ({ page, context }) => {
  await seedExampleWedding(page);
  await page.goto("/binder");
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  // Kept: the worker controls the page and has the page's files.
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.open("binder-v1")).keys()).length))
    .toBeGreaterThan(5);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText("No signal");
  await page.getByRole("navigation", { name: "The Binder" }).getByRole("button", { name: "Day" }).click();
  await expect(page.getByRole("region", { name: "The day" }).getByRole("listitem")).toHaveCount(27);
});
