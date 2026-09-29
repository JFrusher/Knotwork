import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

const ceremony = async (page: Parameters<typeof storedDocument>[0]) => {
  const stored = await storedDocument(page);
  return {
    label: (stored.timeline.blocks as Array<{ id: string; label: string }>).find((block) => block.id === "blk-ceremony")!.label,
    // The resolved day other pages read, republished with the edit.
    published: (stored.day.blocks as Array<{ id: string; label: string }>).find((block) => block.id === "blk-ceremony")!.label,
  };
};

/*
 * Timeline keeps no copy: an edit is in the wedding as it is made, the
 * resolved day is republished with it, and the header's undo takes it back.
 */
test("a block renamed is stored at once, and the header's undo takes it back", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/timeline");
  await page.getByRole("button", { name: /^Ceremony, / }).click();
  await page.getByRole("textbox", { name: "Label" }).fill("Ceremony and vows");
  await expect.poll(() => ceremony(page)).toEqual({ label: "Ceremony and vows", published: "Ceremony and vows" });

  await page.getByRole("button", { name: "Undo changing a block" }).click();
  await expect.poll(() => ceremony(page)).toEqual({ label: "Ceremony", published: "Ceremony" });
  await expect(page.getByRole("textbox", { name: "Label" })).toHaveValue("Ceremony");
});

/*
 * Travel: the photographer finishes the ceremony in the Orangery at 14:15 and
 * is due at the confetti on the front steps at 14:15. Nothing is said until
 * somebody types how long that walk takes.
 */
test("a journey's time is checked once typed, and taken back by undo", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/timeline");
  const problems = page.locator('[data-tour="timeline.problems"]');
  const short =
    "Eleanor Vane Photography finishes Ceremony at 14:15 at Orangery, and is due at Confetti at 14:15 at Front steps, 5 minutes away: 5 minutes short.";
  await expect(problems).not.toContainText("minutes short");

  const minutes = page.getByRole("spinbutton", { name: "Minutes between Orangery and Front steps" });
  await minutes.fill("5");
  await minutes.press("Enter");

  await expect(problems.getByRole("button", { name: short })).toBeVisible();
  await expect
    .poll(async () => (await storedDocument(page)).timeline.travel)
    .toEqual([{ between: ["Orangery", "Front steps"], minutes: 5 }]);

  await page.getByRole("button", { name: "Undo a journey's time" }).click();
  await expect(problems).not.toContainText("minutes short");
  await expect(minutes).toHaveValue("");
});

test("the day downloads as a calendar, whole or one supplier's part of it", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/timeline");
  const summaries = (text: string) => text.split("\r\n").filter((line) => line.startsWith("SUMMARY:"));

  const [whole] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download calendar" }).click()]);
  expect(whole.suggestedFilename()).toBe("alex-and-sam-the-day.ics");
  const day = readFileSync(await whole.path(), "utf8");
  expect(day).toContain("X-WR-CALNAME:Alex & Sam\r\n");
  // The venue's clock, on the wedding's own date.
  expect(day).toContain("SUMMARY:Ceremony\r\n");
  expect(day).toContain("DTSTART:20280601T133000\r\n");
  expect(summaries(day)).toHaveLength(27);

  await page.getByRole("combobox", { name: "Calendar for" }).selectOption({ label: "County Registrar" });
  const [one] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download calendar" }).click()]);
  expect(one.suggestedFilename()).toBe("alex-and-sam-county-registrar.ics");
  expect(summaries(readFileSync(await one.path(), "utf8"))).toEqual(["SUMMARY:Rings to the best man", "SUMMARY:Ceremony"]);
});

/*
 * The clocks. A new wedding's used to show British Summer Time as if chosen —
 * a fallback — and choosing it did nothing, since it was already "selected".
 */
test("clocks nobody has set say so, and choosing British Summer Time sets it", async ({ page }) => {
  await page.goto("/timeline");
  const clocks = page.getByRole("combobox", { name: "Clocks" });
  await expect(clocks.locator("option:checked")).toHaveText("Not set");
  await expect(page.getByText("Set the clocks to see sunset and golden hour.")).toBeVisible();

  await clocks.selectOption({ label: "UTC+1 (BST, CET)" });
  await expect.poll(async () => (await storedDocument(page)).event?.utcOffsetMin).toBe(60);
  await expect(page.getByText(/^Sunset \d\d:\d\d/)).toBeVisible();
});
