import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedExampleWedding, storedWedding } from "./wedding";

/*
 * The account's side is played by answering `/api/accounts/weddings` and
 * `/api/documents` here: the app talks to nothing else to sync a wedding, so
 * what it does with the answers is exactly what it would do signed in.
 */
async function accountHolding(page: Page, coupleNames: string) {
  const account = {
    weddingId: "w1",
    version: 4,
    document: {
      kind: "trousseau",
      version: 1,
      event: { coupleNames, partners: coupleNames.split(" & "), date: "", venueName: "" },
      guests: { r1: { id: "r1", firstName: "Robin" }, k1: { id: "k1", firstName: "Kit" } },
    } as Record<string, unknown>,
  };
  await page.route("**/api/accounts/weddings", (route) =>
    route.fulfill({ json: { weddings: [{ weddingId: "w1", role: "partner", names: coupleNames, date: "" }] } }),
  );
  await page.route("**/api/documents?wedding=w1", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: account });
    const { document } = route.request().postDataJSON() as { document: Record<string, unknown> };
    account.version += 1;
    account.document = document;
    return route.fulfill({ json: { version: account.version, warnings: [] } });
  });
  return account;
}

test("a device with its own wedding is asked which to keep, and the other can be put back", async ({ page }) => {
  await seedExampleWedding(page);
  await accountHolding(page, "Robin & Kit");
  await page.goto("/");

  const data = page.getByRole("dialog", { name: "Your data" });
  await expect(data.getByText("Two different weddings")).toBeVisible();
  await expect(data.getByText("Alex & Sam — 106 guests", { exact: false })).toBeVisible();
  await expect(data.getByText("Robin & Kit — 2 guests")).toBeVisible();
  // Nothing replaced while the question is open.
  expect((await storedWedding(page)).names).toBe("Alex & Sam");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await data.getByRole("button", { name: "Use your account’s" }).click();
  await expect.poll(async () => (await storedWedding(page)).names).toBe("Robin & Kit");

  // This device's wedding was kept, and goes back in one step.
  const copies = data.getByRole("list");
  await expect(copies.getByText(/^Alex & Sam — 106 guests/)).toBeVisible();
  await copies.getByRole("button", { name: "Put it back" }).click();
  await page.getByRole("dialog", { name: "Put this wedding back?" }).getByRole("button", { name: "Put it back" }).click();
  await expect.poll(async () => (await storedWedding(page)).names).toBe("Alex & Sam");
});

test("keeping this device's wedding sends it to the account, and keeps the account's here", async ({ page }) => {
  await seedExampleWedding(page);
  const account = await accountHolding(page, "Robin & Kit");
  await page.goto("/");

  const data = page.getByRole("dialog", { name: "Your data" });
  await data.getByRole("button", { name: "Keep this device’s" }).click();
  await expect.poll(() => (account.document["event"] as { coupleNames: string }).coupleNames).toBe("Alex & Sam");
  await expect(data.getByRole("list").getByText("Robin & Kit — 2 guests")).toBeVisible();

  // The device now belongs to this wedding: a reload asks nothing.
  await page.reload();
  await expect(page.getByRole("button", { name: "Data. Saved on this device and to your account." })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Your data" })).toBeHidden();
});

test("a planner switches between clients, and each comes back as it was", async ({ page }) => {
  const clients: Record<string, { names: string; version: number; document: Record<string, unknown> }> = {
    c1: { names: "Alex & Sam", version: 1, document: { kind: "trousseau", version: 1, event: { coupleNames: "Alex & Sam", partners: ["Alex", "Sam"] }, guests: { a1: { id: "a1", firstName: "Alex" } } } },
    c2: { names: "Robin & Kit", version: 1, document: { kind: "trousseau", version: 1, event: { coupleNames: "Robin & Kit", partners: ["Robin", "Kit"] }, guests: { r1: { id: "r1", firstName: "Robin" } } } },
  };
  await page.route("**/api/accounts/weddings", (route) =>
    route.fulfill({
      json: { weddings: Object.entries(clients).map(([weddingId, c]) => ({ weddingId, role: "planner", names: c.names, date: "" })) },
    }),
  );
  let offline = false;
  await page.route(/\/api\/documents\?wedding=/, async (route) => {
    const id = new URL(route.request().url()).searchParams.get("wedding")!;
    const client = clients[id]!;
    if (route.request().method() === "GET") return route.fulfill({ json: { weddingId: id, ...client } });
    if (offline) return route.abort("internetdisconnected");
    const { document } = route.request().postDataJSON() as { document: Record<string, unknown> };
    client.version += 1;
    client.document = document;
    return route.fulfill({ json: { version: client.version, warnings: [] } });
  });

  // Several clients and none opened here: nothing is picked for them.
  await page.goto("/");
  const menu = (names: string) => page.getByRole("button", { name: new RegExp(`^${names}`) });
  const weddings = page.getByRole("navigation", { name: "Your weddings" });
  await menu("Trousseau").click();
  await expect(weddings.getByRole("link")).toHaveText(["Alex & Sam · client", "Robin & Kit · client", "All weddings", "Library"]);
  await expect(weddings.locator("[aria-current]")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Each switch is a full load through /open; the wedding's name heading the
  // page, and marked in the menu, is the app having loaded again with it.
  const open = async (label: string, from: string, names: string) => {
    await menu(from).click();
    await weddings.getByRole("link", { name: label }).click();
    await menu(names).click();
    await expect(weddings.getByRole("link", { name: label })).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Escape");
    expect((await storedWedding(page)).names).toBe(names);
  };
  await open("Alex & Sam · client", "Trousseau", "Alex & Sam");

  // An edit that cannot reach the account before the switch.
  offline = true;
  await page.getByRole("button", { name: /^Data/ }).click();
  await page.getByRole("textbox", { name: "One of you", exact: true }).fill("Alexa");
  await expect.poll(async () => (await storedWedding(page)).names).toBe("Alexa & Sam");
  await page.getByRole("button", { name: "Close" }).click();
  offline = false;

  await open("Robin & Kit · client", "Alexa & Sam", "Robin & Kit");
  // Back, with the edit — and the edit goes up now that it can.
  await open("Alex & Sam · client", "Robin & Kit", "Alexa & Sam");
  await expect.poll(() => (clients["c1"]!.document["event"] as { coupleNames: string }).coupleNames).toBe("Alexa & Sam");
  await expect(page.getByRole("dialog", { name: "Your data" })).toBeHidden();
});
