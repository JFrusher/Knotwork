import { expect, test, type Page } from "@playwright/test";

/*
 * The one page guests use. The link is sealed here the way the app seals it
 * — AES-GCM, the key in the fragment — and served where the app now serves
 * it, so this is what a guest's phone does with a real link.
 */
/** Seals a snapshot as the app does and serves it at a token, returning the link. */
async function serve(page: Page, snapshot: Record<string, unknown>): Promise<string> {
  const token = "0123456789abcdef0123456789abcdef";
  await page.goto("/support");
  const { key, sealed } = await page.evaluate(async (snapshot) => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(JSON.stringify(snapshot))),
    );
    return {
      key: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      sealed: { ciphertext: b64(ciphertext), iv: b64(iv) },
    };
  }, snapshot);
  await page.route(`**/api/share/${token}`, (route) => route.fulfill({ json: sealed }));
  return `/seat/${token}#k=${key}`;
}

const SNAPSHOT = {
  coupleNames: "Alex & Sam",
  venueName: "The Old Granary",
  date: "2028-06-01",
  guests: [{ name: "Ann Lee", table: "Table 4", seat: null }],
  tables: null,
  publishedAt: new Date().toISOString(),
};

// Published before a link could carry the order of service: it has none, and says only what it holds.
test("a guest opens their link and finds their table", async ({ page }) => {
  await page.goto(await serve(page, SNAPSHOT));
  await expect(page.getByRole("heading", { name: "Alex & Sam" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your name" }).fill("ann");
  await expect(page.getByText("Table 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The ceremony" })).toHaveCount(0);
  await expect(page.getByText("This page holds names and table numbers, and nothing else.")).toBeVisible();
});

test("a guest follows the order of service on their phone, when the couple shares it", async ({ page }) => {
  const ceremony = [
    { title: "Sonnet 116", author: "William Shakespeare", note: "", people: ["Jonty Oyelaran"], music: [], lines: [], passages: [{ text: "Let me not to the marriage of true minds", layout: "poem" }] },
    { title: "The vows", author: "", note: "Please stand", people: [], music: [], lines: [], passages: [{ text: "Will you?\nAll: We will.", layout: "responses" }] },
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(await serve(page, { ...SNAPSHOT, ceremony }));
  const order = page.getByRole("region", { name: "The ceremony" });
  await expect(order.getByRole("heading", { name: "Sonnet 116" })).toBeVisible();
  await expect(order.getByText("Let me not to the marriage of true minds")).toBeVisible();
  await expect(order.getByText("Please stand")).toBeVisible();
  await expect(order.getByText("All: We will.")).toHaveClass(/font-semibold/);
  await expect(page.getByText("This page holds names and table numbers and the order of service, and nothing else.")).toBeVisible();
});

test("a link that has been taken down says so", async ({ page }) => {
  await page.route("**/api/share/*", (route) => route.fulfill({ status: 404, json: { error: "This link is not live." } }));
  await page.goto("/seat/0123456789abcdef0123456789abcdef#k=anything");
  await expect(page.getByText("This link is not live. Ask the couple for a new one.")).toBeVisible();
});
