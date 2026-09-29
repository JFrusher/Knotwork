import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

/*
 * Which tools a wedding shows is the wedding's own choice, kept in it: the
 * five by default, any of them removable, and a removal only ever hides.
 */

test("a tool removed from Tools leaves the header, and undo brings it back", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/checklist");
  const tabs = page.getByRole("navigation", { name: "Tools" });
  await expect(tabs.getByRole("link", { name: "Seating" })).toBeVisible();

  await tabs.getByRole("button", { name: "Add or remove tools" }).click();
  const panel = page.getByRole("dialog", { name: "Tools" });
  await panel.getByRole("button", { name: "Remove Seating" }).click();
  await expect(panel.getByRole("button", { name: "Add Seating" })).toBeVisible();
  // Closed first: the header is inert behind the panel.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await expect(tabs.getByRole("link", { name: "Seating" })).toHaveCount(0);
  await expect(tabs.getByRole("link", { name: "Timeline" })).toBeVisible();

  await page.getByRole("button", { name: "Undo removing Seating" }).click();
  await expect(tabs.getByRole("link", { name: "Seating" })).toBeVisible();
});

test("a removal is kept in the wedding and survives a reload", async ({ page }) => {
  await seedExampleWedding(page);
  // Addressable, as every slide-over is.
  await page.goto("/?panel=tools");
  const panel = page.getByRole("dialog", { name: "Tools" });
  await panel.getByRole("button", { name: "Remove Group shots" }).click();

  // Stored before the reload is relied on: the write is what is being tested.
  await expect
    .poll(async () => (await storedDocument(page)).tools?.shown)
    .toEqual(["seating", "place-cards", "timeline", "delegation"]);
  await page.goto("/");

  const tabs = page.getByRole("navigation", { name: "Tools" });
  await expect(tabs.getByRole("link", { name: "Delegation" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Group shots" })).toHaveCount(0);
  // Its area on the front page goes with it; the wedding's own pages stay.
  const areas = page.getByRole("region", { name: "Where things stand" });
  await expect(areas.getByRole("link", { name: /Guests/ })).toBeVisible();
  await expect(areas.getByRole("link", { name: /Group shots/ })).toHaveCount(0);
});
