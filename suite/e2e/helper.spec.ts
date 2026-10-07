import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/*
 * The page a day-of helper uses, on a phone, often without signal. The sheet
 * is sealed here the way the app seals it — AES-GCM, the key in the fragment —
 * and served where the app serves it.
 */
test.use({ viewport: { width: 390, height: 844 } });

const TOKEN = "fedcba9876543210fedcba9876543210";
const API = `**/api/helpers/${TOKEN}`;

async function aSealedSheet(page: Page) {
  await page.goto("/support");
  const { key, sealed } = await page.evaluate(async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sheet = {
      wedding: { names: "Alex & Sam", date: "2028-06-01", venue: "The Old Granary" },
      helper: { name: "Rafferty Sørensen", team: "" },
      day: [
        { label: "Ceremony", when: "13:30–14:15", where: "Orangery" },
        { label: "Group photos", when: "14:30–15:15", where: "The lawn" },
      ],
      jobs: [{ label: "Bring the rings", when: "13:30–14:15", where: "Orangery", who: ["Rafferty Sørensen"] }],
      boxes: [{ number: 1, name: "The rings and the paperwork", where: "Orangery, by 13:30", items: ["Rings", "Licence"], takenBy: ["Rafferty Sørensen"] }],
      shots: [{ section: "The couple", shots: [{ label: "The couple, alone", names: ["Alex Morgan", "Sam Reyes"] }] }],
      crew: [{ name: "Eleanor Vane Photography", role: "photographer", phone: "07700 900141" }],
    };
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(JSON.stringify(sheet))),
    );
    return {
      key: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      sealed: { ciphertext: b64(ciphertext), iv: b64(iv) },
    };
  });
  await page.route(API, (route) => route.fulfill({ json: { ...sealed, publishedAt: "2026-10-07T12:00:00Z" } }));
  return key;
}

test("a helper opens their link: their jobs, the day, the boxes, the photos, numbers to ring", async ({ page }) => {
  const key = await aSealedSheet(page);
  await page.goto(`/helper/${TOKEN}#k=${key}`);

  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("For Rafferty Sørensen");
  await expect(main.getByRole("region", { name: "Your jobs" })).toContainText("Bring the rings");
  await expect(main.getByRole("region", { name: "The day" }).getByRole("listitem")).toHaveCount(2);
  await expect(main.getByRole("region", { name: "The boxes" })).toContainText("Rings, Licence");
  await expect(main.getByRole("region", { name: "The photos" })).toContainText("Alex Morgan, Sam Reyes");
  await expect(main.getByRole("link", { name: "Ring Eleanor Vane Photography, 07700 900141" })).toHaveAttribute("href", "tel:07700900141");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("with no signal, it opens from the copy on the phone", async ({ page, context }) => {
  const key = await aSealedSheet(page);
  await page.goto(`/helper/${TOKEN}#k=${key}`);
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.open("binder-v1")).keys()).length))
    .toBeGreaterThan(5);

  await page.unroute(API);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("No signal");
  await expect(page.getByRole("region", { name: "Your jobs" })).toContainText("Bring the rings");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("a link taken down says so, and forgets the copy on the phone", async ({ page, context }) => {
  const key = await aSealedSheet(page);
  await page.goto(`/helper/${TOKEN}#k=${key}`);
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();

  await page.unroute(API);
  await page.route(API, (route) => route.fulfill({ status: 404, json: { error: "This link is not live." } }));
  await page.reload();
  await expect(page.getByText("This link is not live. Ask whoever sent it for a new one.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // And with no signal afterwards there is nothing left to open.
  await page.unroute(API);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("this link has not been opened on this phone before")).toBeVisible();
});
