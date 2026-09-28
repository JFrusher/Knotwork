import { expect, test } from "@playwright/test";
import { openSeating, seedExampleWedding, storedWedding } from "./wedding";

/**
 * An edit shown on screen is an edit that survives a reload. Seating once
 * handed its plan over every 30 seconds and the store wrote it from a timer
 * that never fired during unload, so a rename followed by a reload vanished.
 */
test("a Seating edit survives an immediate reload", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);

  await page.getByRole("button", { name: /^Table 1, / }).click();
  await page.getByLabel("Table name").fill("Head table");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /^Head table, / })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /^Head table, / })).toBeVisible();
});

/**
 * The Data panel opens over whichever tool is on screen and writes the shared
 * wedding directly. Seating holds its own copy of the guests and the names, and
 * its next save once wrote that copy back: an import reported as "3 new" was
 * gone after one table rename, and the couple's names reverted with it.
 */
test("a guest import and a rename in the Data panel survive editing in Seating", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
  const guests = page.getByTitle(/guests on this device$/);
  await expect(guests).toHaveText("106");

  await page.getByRole("button", { name: "Data" }).click();
  const data = page.getByRole("dialog", { name: "Your data" });
  await data.getByLabel("One of you").fill("Robin");
  await data.getByLabel("The other").fill("Kit");
  await data.getByRole("button", { name: "Import guests" }).click();
  const importer = page.getByRole("dialog", { name: "Import guests" });
  await importer.getByLabel("Guest list CSV").setInputFiles({
    name: "three.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("First Name,Last Name\nZelda,Newcomer\nYusuf,Newcomer\nXanthe,Newcomer\n"),
  });
  await importer.getByRole("button", { name: "See what will change" }).click();
  await importer.getByRole("button", { name: "Import", exact: true }).click();
  await expect(importer.getByText(/Imported: 3 new/)).toBeVisible();
  await importer.getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape");
  await expect(guests).toHaveText("109");

  // Seating shows what the panel wrote, and its own edits land on top of it.
  await expect(page.getByText("109 guests · 6 unassigned")).toBeVisible();
  await page.getByRole("button", { name: /^Table 1, / }).click();
  await page.getByLabel("Table name").fill("Head table");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /^Head table, / })).toBeVisible();

  // All three stored together: the import, the names, and Seating's own edit.
  // Waited for rather than reloaded into, so this is about what was written —
  // an edit caught mid-save by a reload is the test above's business.
  await expect
    .poll(() => storedWedding(page))
    .toMatchObject({ guests: 109, names: "Robin & Kit", tables: expect.arrayContaining(["Head table"]) });

  await page.reload();
  await expect(page.getByRole("button", { name: /^Head table, / })).toBeVisible();
  await expect(guests).toHaveText("109");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Robin & Kit");
});
