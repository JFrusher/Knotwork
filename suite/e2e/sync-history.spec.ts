import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedExampleWedding, storedWedding } from "./wedding";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const V3 = "33333333-3333-4333-8333-333333333333";

/*
 * The account's side is played by answering its routes here, as in
 * signing-in.spec: a wedding with no document yet, so this device's goes up
 * and the two are linked; then a history of three saved versions.
 */
async function anAccount(page: Page) {
  const example = await page.evaluate(async () => (await fetch("/fixtures/example-wedding.trousseau.json")).json());
  const guests = example.guests as Record<string, unknown>;
  // Two guests fewer, and saved by a partner.
  const earlier = { ...example, guests: Object.fromEntries(Object.entries(guests).slice(2)) };
  const versions: Record<string, unknown> = { [V3]: example, [V2]: earlier, [V1]: { ...earlier, guests: {} } };
  const account = { version: 0, document: null as unknown, pushed: [] as unknown[] };

  await page.route("**/api/accounts/weddings", (route) =>
    route.fulfill({ json: { weddings: [{ weddingId: "w1", role: "partner", names: "Alex & Sam", date: "" }] } }),
  );
  await page.route("**/api/documents?wedding=w1", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { weddingId: "w1", version: account.version, document: account.document } });
    const { document } = route.request().postDataJSON() as { document: unknown };
    account.version += 1;
    account.document = document;
    account.pushed.push(document);
    return route.fulfill({ json: { version: account.version, warnings: [] } });
  });
  await page.route("**/api/documents/history?wedding=w1", (route) =>
    route.fulfill({
      json: {
        entries: [
          { id: V3, savedAt: "2026-09-28T14:05:00Z", savedBy: "alex@example.com", yours: true },
          { id: V2, savedAt: "2026-09-27T09:30:00Z", savedBy: "sam@example.com", yours: false },
          { id: V1, savedAt: "2026-09-20T18:00:00Z", savedBy: null, yours: false },
        ],
      },
    }),
  );
  await page.route(/\/api\/documents\/history\/[0-9a-f-]+\?wedding=w1/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop()!;
    return route.fulfill({ json: { document: versions[id] } });
  });
  return account;
}

test("the account's saved versions: who saved each, what changed, and one put back", async ({ page }) => {
  await seedExampleWedding(page);
  const account = await anAccount(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Data. Saved on this device and to your account." })).toBeVisible();

  await page.getByRole("button", { name: /^Data/ }).click();
  await page.getByRole("dialog", { name: "Your data" }).getByRole("button", { name: "Sync & history" }).click();
  const panel = page.getByRole("dialog", { name: "Sync & history" });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/[?&]panel=sync/);

  // The versions themselves, not the lines of what changed inside one.
  const versions = panel.getByRole("region", { name: "Saved versions" }).locator("ol > li");
  await expect(versions).toHaveCount(3);
  await expect(versions.nth(0)).toContainText("You");
  await expect(versions.nth(1)).toContainText("sam@example.com");
  await expect(versions.nth(2)).toContainText("Someone no longer on this wedding");
  expect((await new AxeBuilder({ page }).include("dialog[open]").analyze()).violations).toEqual([]);

  await versions.nth(0).getByRole("button", { name: "What changed" }).click();
  await expect(versions.nth(0)).toContainText("Guests: 2 added");

  await versions.nth(1).getByRole("button", { name: "Put this version back" }).click();
  await page.getByRole("dialog", { name: "Put this version back?" }).getByRole("button", { name: "Put it back" }).click();
  await expect(panel).toBeHidden();
  await expect.poll(async () => (await storedWedding(page)).guests).toBe(104);
  // Put back for everyone: it goes up to the account.
  await expect.poll(() => Object.keys((account.document as { guests: object }).guests).length).toBe(104);

  // And the wedding as it was is kept on this device.
  await page.getByRole("button", { name: /^Data/ }).click();
  await expect(page.getByRole("dialog", { name: "Your data" }).getByText(/Before putting back the version from/)).toBeVisible();
});

test("a link to Sync & history opens it", async ({ page }) => {
  await seedExampleWedding(page);
  await anAccount(page);
  await page.goto("/?panel=sync");
  await expect(page.getByRole("dialog", { name: "Sync & history" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/panel=sync/);
});

test("a partner's change to one guest merges in; the same guest changed on both sides is laid side by side", async ({ page }) => {
  await seedExampleWedding(page);
  const example = await page.evaluate(async () => (await fetch("/fixtures/example-wedding.trousseau.json")).json());
  const id = (first: string, last: string) =>
    Object.values(example.guests as Record<string, { id: string; firstName: string; lastName: string }>).find(
      (guest) => guest.firstName === first && guest.lastName === last,
    )!.id;
  const niamh = id("Niamh", "MacIntyre");
  const zainab = id("Zainab", "Thistlewood");

  const account = { version: 0, document: null as null | { guests: Record<string, Record<string, unknown>> } };
  await page.route("**/api/accounts/weddings", (route) =>
    route.fulfill({ json: { weddings: [{ weddingId: "w1", role: "partner", names: "Alex & Sam", date: "" }] } }),
  );
  await page.route("**/api/documents?wedding=w1", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { weddingId: "w1", version: account.version, document: account.document } });
    const { document, expectedVersion } = route.request().postDataJSON() as { document: typeof account.document; expectedVersion: number };
    if (expectedVersion !== account.version) {
      return route.fulfill({ status: 409, json: { version: account.version, document: account.document } });
    }
    account.version += 1;
    account.document = document;
    return route.fulfill({ json: { version: account.version, warnings: [] } });
  });

  await page.goto("/guests");
  await expect(page.getByRole("button", { name: "Data. Saved on this device and to your account." })).toBeVisible();

  // Meanwhile, on the partner's device.
  const theirs = structuredClone(account.document!);
  theirs.guests[niamh] = { ...theirs.guests[niamh], rsvpStatus: "declined" };
  theirs.guests[zainab] = { ...theirs.guests[zainab], dietaryRaw: "Vegan", dietary: "vegan" };
  account.document = theirs;
  account.version += 1;

  // And here, before this device has seen it.
  await page.getByRole("searchbox").fill("Niamh MacIntyre");
  await page.getByLabel("Reply from Niamh MacIntyre").selectOption({ label: "Yes" });

  await page.getByRole("button", { name: /^Needs you/ }).click();
  const panel = page.getByRole("dialog", { name: "Sync & history" });
  const both = panel.getByRole("region", { name: "Changed on both sides" });
  await expect(both.getByRole("listitem")).toHaveCount(1);
  await expect(both).toContainText("Niamh MacIntyre (a guest)");
  await expect(both.getByRole("row", { name: /Reply/ })).toContainText(/confirmed\s*declined/);
  await both.getByRole("button", { name: "Use theirs" }).click();
  await page.keyboard.press("Escape");

  // Theirs for Niamh; Zainab's change came in without a question; and the
  // settled wedding went up.
  await page.getByRole("searchbox").fill("Niamh MacIntyre");
  await expect(page.getByLabel("Reply from Niamh MacIntyre")).toHaveValue("declined");
  await page.getByRole("searchbox").fill("Zainab Thistlewood");
  await expect(page.getByLabel("What Zainab Thistlewood eats")).toHaveValue("Vegan");
  await expect.poll(() => account.version).toBe(3);
  expect(account.document!.guests[niamh]).toMatchObject({ rsvpStatus: "declined" });
  expect(account.document!.guests[zainab]).toMatchObject({ dietaryRaw: "Vegan" });
});
