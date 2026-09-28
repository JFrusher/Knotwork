import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/**
 * A save that failed has to be said out loud.
 *
 * The store recorded it — `persist` sets an error "so it goes on screen" — but
 * the only two things that read that error show it for a wedding that could
 * not be *read*, never for one that could not be written. A full disk or a
 * browser refusing storage mid-session left the header, the Data panel and the
 * tools all looking exactly as they do after a good save.
 */
test("a change that could not be saved is shown as not saved", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alex & Sam");

  // From here on the browser refuses every write, as a full disk does.
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
  });

  await page.getByRole("button", { name: "Data" }).click();
  await page.getByRole("dialog", { name: "Your data" }).getByLabel("Venue").fill("Somewhere else");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: /^Not saved/ })).toBeVisible();
});
