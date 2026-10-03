import { expect, test } from "@playwright/test";
import { storedDocument } from "./wedding";

/*
 * Someone arriving with nothing: what Knotwork is, a look around a finished
 * wedding, and the way back out to their own.
 */
test("a first visit can explore the example, then start its own wedding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plan the whole wedding in one place.", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up your wedding" })).toBeVisible();

  await page.getByRole("button", { name: "Explore the example wedding" }).click();
  await expect(page.getByRole("dialog", { name: /Your wedding/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("heading", { name: "Alex & Sam", level: 1 })).toBeVisible();
  const banner = page.getByRole("region", { name: "Example wedding" });
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: "Start your own wedding" }).click();
  await expect(page.getByRole("heading", { name: "Plan the whole wedding in one place.", level: 1 })).toBeVisible();
  await expect.poll(async () => (await storedDocument(page)).exampleWedding).toBeUndefined();

  // Changed their mind: one undo, from any tool, brings the example back.
  await page.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: "Seating" }).click();
  await page.getByRole("button", { name: "Undo starting your own wedding" }).click();
  await expect.poll(async () => (await storedDocument(page)).exampleWedding).toBe(true);
});

test("the welcome stays welcoming after a reload, and a setup replaces it", async ({ page }) => {
  await page.goto("/");
  await page.reload();
  await page.getByRole("link", { name: "Set up your wedding" }).click();
  await expect(page).toHaveURL(/\/setup$/);
});
