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
