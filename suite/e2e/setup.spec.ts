import { expect, test } from "@playwright/test";
import { storedWedding } from "./wedding";

test("setup is a draft until the room step, then one change: undone in one step", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Set up your wedding" }).click();
  await expect(page.getByRole("heading", { name: "The two of you" })).toBeVisible();

  await page.getByRole("textbox", { name: "One of you", exact: true }).fill("Alex");
  await page.getByRole("textbox", { name: "The other", exact: true }).fill("Sam");
  await page.getByRole("textbox", { name: "Venue", exact: true }).fill("The Old Granary");
  await page.getByRole("button", { name: "Next" }).click();

  // Pasted names, and a file through the one importer — both into the draft.
  await page.getByRole("button", { name: "Paste names" }).click();
  await page.getByLabel("One name per line").fill("Ann Lee\nBo Chen\nCy Dent\n");
  await page.getByRole("button", { name: "Add them" }).click();
  await expect(page.getByText("3 guests so far.")).toBeVisible();

  await page.getByRole("button", { name: "Import a file" }).click();
  const importer = page.getByRole("dialog", { name: "Import guests" });
  await importer.getByLabel("Guest list CSV").setInputFiles({
    name: "replies.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Name,Side\nBo Chen,Sam\nDee Ford,Alex\nEd Gray,Sam\n"),
  });
  await importer.getByRole("button", { name: "See what will change" }).click();
  // Matched against the draft: Bo is already on it.
  await expect(importer.getByText(/^2 new, 1 updated/)).toBeVisible();
  await importer.getByRole("button", { name: "Import", exact: true }).click();
  await importer.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("5 guests so far.")).toBeVisible();

  // Nothing written yet.
  expect(await storedWedding(page)).toMatchObject({ guests: 0, names: "" });

  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("1 round tables of 8 for 5 guests").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Planning together" })).toBeVisible();

  await expect.poll(() => storedWedding(page)).toMatchObject({ guests: 5, names: "Alex & Sam", tables: ["Table 1"] });

  // One step, named for what it was. Through the header: history is kept in
  // memory, and begins again at every full load.
  await page.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: "Group shots" }).click();
  await page.getByRole("button", { name: "Undo setting up the wedding" }).click();
  await expect.poll(() => storedWedding(page)).toMatchObject({ guests: 0, names: "", tables: [] });
});

test("the front page leads with setup only while there is nothing to show", async ({ page }) => {
  await page.goto("/setup");
  await page.getByRole("textbox", { name: "One of you", exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Later — next" }).click();
  await page.getByLabel("Not yet").check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await page.getByRole("link", { name: "See where things stand" }).click();
  await expect(page.getByRole("heading", { name: "Alex", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up your wedding" })).toHaveCount(0);
});

test("Seating opens on the room setup laid out", async ({ page }) => {
  await page.goto("/setup");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Paste names" }).click();
  await page.getByLabel("One name per line").fill(Array.from({ length: 20 }, (_, i) => `Guest ${i + 1}`).join("\n"));
  await page.getByRole("button", { name: "Add them" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByRole("link", { name: "Open Seating" }).click();

  for (const n of [1, 2, 3]) await expect(page.getByRole("button", { name: new RegExp(`^Table ${n}, `) })).toBeVisible();
  await expect(page.getByText("20 guests · 20 unassigned")).toBeVisible();
});
