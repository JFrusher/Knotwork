import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

const ID = "44444444-4444-4444-8444-444444444444";

/*
 * The library lives on the account, so its routes are answered here. What is
 * worth holding: nobody from this wedding goes into it, and putting a design
 * into a wedding is one change, taken back by one undo.
 */
test("a room is kept with every chair empty, and put back in one undoable step", async ({ page }) => {
  await seedExampleWedding(page);
  const library: Array<{ id: string; kind: string; name: string; createdAt: string; content: Record<string, unknown> }> = [];
  await page.route("**/api/library", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { items: library.map(({ content: _content, ...listing }) => listing) } });
    }
    const body = route.request().postDataJSON() as { kind: string; name: string; content: Record<string, unknown> };
    library.unshift({ id: ID, createdAt: "2026-09-28T10:00:00Z", ...body });
    return route.fulfill({ json: { item: library[0] } });
  });
  await page.route(`**/api/library/${ID}`, (route) => route.fulfill({ json: { content: library[0]!.content } }));

  await page.goto("/library");
  const keep = page.getByRole("region", { name: "Keep from Alex & Sam" });
  const room = keep.getByRole("listitem").filter({ hasText: "Room" });
  await room.getByLabel("Name for this room").fill("The Old Granary, fourteen rounds");
  await room.getByRole("button", { name: "Keep" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Kept “The Old Granary, fourteen rounds”.");

  // Nobody from this wedding went with it.
  const guests = Object.keys((await storedDocument(page))["guests"] as object);
  const kept = JSON.stringify(library[0]!.content);
  expect(guests.filter((id) => kept.includes(id))).toEqual([]);

  const item = page.getByRole("region", { name: "Kept" }).getByRole("listitem").filter({ hasText: "The Old Granary, fourteen rounds" });
  await item.getByRole("button", { name: "Use in this wedding" }).click();
  await page.getByRole("dialog", { name: "Use “The Old Granary, fourteen rounds” here?" }).getByRole("button", { name: "Use it" }).click();
  const seated = async () =>
    Object.values((await storedDocument(page))["guests"] as Record<string, { assignedTableId: string | null }>).filter((guest) => guest.assignedTableId).length;
  await expect.poll(seated).toBe(0);

  await page.getByRole("button", { name: "Undo using “The Old Granary, fourteen rounds”" }).click();
  await expect.poll(seated).toBe(97);
});

test("signed out, the library says it is kept on an account", async ({ page }) => {
  await page.route("**/api/library", (route) => route.fulfill({ status: 401, json: { error: "Sign in first." } }));
  await page.goto("/library");
  await expect(page.getByText("The library is kept on your account.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toHaveAttribute("href", "/login?next=%2Flibrary");
});
