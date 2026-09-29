import { expect, test } from "@playwright/test";

/*
 * The one page guests use. The link is sealed here the way the app seals it
 * — AES-GCM, the key in the fragment — and served where the app now serves
 * it, so this is what a guest's phone does with a real link.
 */
test("a guest opens their link and finds their table", async ({ page }) => {
  const token = "0123456789abcdef0123456789abcdef";
  await page.goto("/support");
  const { key, sealed } = await page.evaluate(async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const snapshot = {
      coupleNames: "Alex & Sam",
      venueName: "The Old Granary",
      date: "2028-06-01",
      guests: [{ name: "Ann Lee", table: "Table 4", seat: null }],
      tables: null,
      publishedAt: new Date().toISOString(),
    };
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(JSON.stringify(snapshot))),
    );
    return {
      key: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      sealed: { ciphertext: b64(ciphertext), iv: b64(iv) },
    };
  });
  await page.route(`**/api/share/${token}`, (route) => route.fulfill({ json: sealed }));

  await page.goto(`/seat/${token}#k=${key}`);
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your name" }).fill("ann");
  await expect(page.getByText("Table 4")).toBeVisible();
});

test("a link that has been taken down says so", async ({ page }) => {
  await page.route("**/api/share/*", (route) => route.fulfill({ status: 404, json: { error: "This link is not live." } }));
  await page.goto("/seat/0123456789abcdef0123456789abcdef#k=anything");
  await expect(page.getByText("This link is not live. Ask the couple for a new one.")).toBeVisible();
});
