import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

const onRings = async (page: Parameters<typeof storedDocument>[0]) =>
  ((await storedDocument(page)).crew.jobs as Array<{ id: string; personIds: string[] }>).find((job) => job.id === "job_ex00x")!
    .personIds;

/*
 * Delegation keeps no copy: an edit is in the wedding as it is made, and the
 * header's undo — the wedding's one history — takes it back.
 */
test("someone put on a job is stored at once, and the header's undo takes it back", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/delegation");
  await page.getByRole("button", { name: /^Bring the rings/ }).click();
  await page.getByTitle("Put Ines Ashdown on Bring the rings").click();
  await expect.poll(() => onRings(page)).toEqual(["p_ex00p", "p_ex00q"]);

  await page.getByRole("button", { name: "Undo who is on a job" }).click();
  await expect.poll(() => onRings(page)).toEqual(["p_ex00p"]);
  // Still on the job it was working on: nothing was remounted.
  await expect(page.getByRole("textbox", { name: "Job", exact: true })).toHaveValue("Bring the rings");
});
