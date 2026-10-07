import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/*
 * The one page a supplier uses. The sheet is sealed here the way the app
 * seals it — AES-GCM, the key in the fragment — and served where the app
 * serves it, so this is what a supplier's phone does with a real link.
 */
const TOKEN = "0123456789abcdef0123456789abcdef";

async function aSealedSheet(page: Page, confirmedAt: string | null) {
  await page.goto("/support");
  const { key, sealed } = await page.evaluate(async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sheet = {
      wedding: { names: "Alex & Sam", date: "2028-06-01", venue: "The Old Granary" },
      supplier: "Eleanor Vane Photography",
      arrival: "07:45",
      people: ["Maya Ivers"],
      jobs: [{ label: "Photograph the ceremony", when: "13:30–14:15", where: "Orangery", during: "Ceremony" }],
      before: [{ label: "Send the shot list back", by: "18 May 2028" }],
      calendar: {
        couple: "Alex & Sam",
        tagLabel: "Eleanor Vane Photography",
        events: [{ id: "blk-ceremony", label: "Ceremony", location: "Orangery", startMin: 810, endMin: 855 }],
      },
    };
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(JSON.stringify(sheet))),
    );
    return {
      key: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      sealed: { ciphertext: b64(ciphertext), iv: b64(iv) },
    };
  });
  const confirmations: string[] = [];
  await page.route(`**/api/suppliers/${TOKEN}`, (route) => {
    if (route.request().method() === "POST") {
      confirmations.push(route.request().url());
      return route.fulfill({ json: { confirmedAt: "2026-09-29T10:00:00Z" } });
    }
    return route.fulfill({ json: { ...sealed, publishedAt: "2026-09-28T12:00:00Z", confirmedAt } });
  });
  return { key, confirmations };
}

test("a supplier opens their link, sees their own call sheet, and confirms it", async ({ page }) => {
  const { key, confirmations } = await aSealedSheet(page, null);
  await page.goto(`/supplier/${TOKEN}#k=${key}`);

  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("For Eleanor Vane Photography");
  await expect(main.getByRole("region", { name: "Arrive" })).toContainText("07:45");
  await expect(main.getByRole("region", { name: "On the day" })).toContainText("13:30–14:15");
  await expect(main.getByRole("region", { name: "On the day" })).toContainText("Photograph the ceremony");
  await expect(main.getByRole("region", { name: "Before the day" })).toContainText("by 18 May 2028");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await main.getByRole("button", { name: "Confirm" }).click();
  await expect(main.getByRole("status")).toHaveText("You confirmed this on 29 September 2026. Thank you.");
  expect(confirmations).toHaveLength(1);
});

test("a supplier adds their part of the day to their calendar", async ({ page }) => {
  const { key } = await aSealedSheet(page, null);
  await page.goto(`/supplier/${TOKEN}#k=${key}`);
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Add to calendar" }).click()]);
  expect(file.suggestedFilename()).toBe("alex-and-sam-eleanor-vane-photography.ics");
  const text = readFileSync(await file.path(), "utf8");
  expect(text).toContain("DTSTART:20280601T133000");
  expect(text).toContain("SUMMARY:Ceremony");
});

test("a sheet that changed after they confirmed asks them to look again", async ({ page }) => {
  const { key } = await aSealedSheet(page, "2026-09-27T09:00:00Z");
  await page.goto(`/supplier/${TOKEN}#k=${key}`);
  await expect(page.getByRole("main")).toContainText("This has changed since you confirmed it on 27 September 2026.");
  await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
});

test("a link that has been taken down says so", async ({ page }) => {
  await page.route("**/api/suppliers/*", (route) => route.fulfill({ status: 404, json: { error: "This link is not live." } }));
  await page.goto(`/supplier/${TOKEN}#k=anything`);
  await expect(page.getByText("This link is not live. Ask whoever sent it for a new one.")).toBeVisible();
});
