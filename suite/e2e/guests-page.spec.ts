import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

/*
 * The Guests page changes the one list the tools read. What is worth holding
 * is that a change made here is the change Seating sees — the guest and the
 * table's list together — and that one undo takes a bulk change back whole.
 */
test("the ones still to seat are found, ticked, and seated together; one undo takes it back", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/guests");

  const search = page.getByRole("search");
  await search.getByLabel("Reply").selectOption({ label: "Yes" });
  await search.getByLabel("Table").selectOption({ label: "No table yet" });
  const list = page.getByRole("table");
  await expect(list.getByRole("rowheader")).toHaveText(["Bartholomew Pemberton-Blythe", "Zainab Thistlewood"]);

  await page.getByRole("checkbox", { name: "Tick everyone shown" }).check();
  const ticked = page.getByRole("group", { name: "Change the ticked guests" });
  await expect(ticked).toContainText("2 guests ticked");
  await ticked.getByLabel("Move them to a table").selectOption({ label: "Table 13 — 8 free" });
  await expect(page.getByText("Nobody on the list matches.")).toBeVisible();

  // Seating reads the same: both at Table 13, and the table knows it.
  await page.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: "Seating" }).click();
  await expect(page.getByRole("button", { name: "Table 13, 2 of 8 seats taken" })).toBeVisible();

  await page.goBack();
  await page.getByRole("button", { name: "Undo seating" }).click();
  await page.getByRole("search").getByLabel("Reply").selectOption({ label: "Yes" });
  await page.getByRole("search").getByLabel("Table").selectOption({ label: "No table yet" });
  await expect(page.getByRole("table").getByRole("rowheader")).toHaveCount(2);
});

test("a reply changed in its row is kept", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/guests");

  await page.getByRole("searchbox").fill("Niamh MacIntyre");
  await page.getByLabel("Reply from Niamh MacIntyre").selectOption({ label: "Yes" });
  await page.getByLabel("What Niamh MacIntyre eats").fill("Coeliac");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("row", { name: /Niamh MacIntyre/ })).toContainText("Gluten-free");

  // Stored, and then reloaded into: what a reload reads is what was written.
  const niamh = async () =>
    Object.values((await storedDocument(page))["guests"] as Record<string, { firstName: string; lastName: string; rsvpStatus: string; dietaryRaw: string }>).find(
      (guest) => guest.firstName === "Niamh" && guest.lastName === "MacIntyre",
    );
  await expect.poll(niamh).toMatchObject({ rsvpStatus: "confirmed", dietaryRaw: "Coeliac" });
  await page.reload();
  await page.getByRole("searchbox").fill("Niamh MacIntyre");
  await expect(page.getByLabel("Reply from Niamh MacIntyre")).toHaveValue("confirmed");
  await expect(page.getByLabel("What Niamh MacIntyre eats")).toHaveValue("Coeliac");
});
