import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedExampleWedding, storedWedding } from "./wedding";

/*
 * The account's side is played by answering `/api/documents` here: the app
 * talks to nothing else to sync the wedding, so what it does with the answer
 * is exactly what it would do signed in.
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
  await page.route("**/api/documents", async (route) => {
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
  await expect(data.getByText("Alex & Sam — 100 guests", { exact: false })).toBeVisible();
  await expect(data.getByText("Robin & Kit — 2 guests")).toBeVisible();
  // Nothing replaced while the question is open.
  expect((await storedWedding(page)).names).toBe("Alex & Sam");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await data.getByRole("button", { name: "Use your account’s" }).click();
  await expect.poll(async () => (await storedWedding(page)).names).toBe("Robin & Kit");

  // This device's wedding was kept, and goes back in one step.
  const copies = data.getByRole("list");
  await expect(copies.getByText(/^Alex & Sam — 100 guests/)).toBeVisible();
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
