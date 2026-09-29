import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

const order = async (page: Parameters<typeof storedDocument>[0]) =>
  ((await storedDocument(page)).ceremony?.processional ?? []).map((group: { id: string }) => group.id);

/*
 * Ceremony keeps no copy: the processional is in the wedding as it is changed,
 * and the header's undo takes a change back.
 */
test("the processional walks in its order, and a group moved is moved in the wedding", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/ceremony");
  const processional = page.getByRole("list", { name: "The processional" });
  await expect(processional.getByRole("listitem")).toHaveCount(6);
  await expect(processional.getByRole("listitem").first()).toContainText("1. The registrar");
  await expect(processional.getByRole("listitem").last()).toContainText("6. Alex + Sam");

  await page.getByRole("button", { name: "Move Alex + Sam earlier" }).click();
  await expect.poll(() => order(page)).toEqual([
    "walk-registrar",
    "walk-a-parents",
    "walk-b-parents",
    "walk-a-party",
    "walk-couple",
    "walk-b-party",
  ]);

  await page.getByRole("button", { name: "Undo changing the order" }).click();
  await expect.poll(async () => (await order(page)).at(-1)).toBe("walk-couple");
});

test("a new wedding adds Ceremony from Tools and is given a starting order, and told who is missing", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Tools" });
  await tabs.getByRole("button", { name: "Add or remove tools" }).click();
  await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Add Ceremony" }).click();
  await page.keyboard.press("Escape");
  await tabs.getByRole("link", { name: "Ceremony" }).click();

  await page.getByRole("button", { name: "Suggest an order" }).click();
  const processional = page.getByRole("list", { name: "The processional" });
  await expect(processional.getByRole("listitem")).toHaveText([/1\. The officiant/, /2\. Partner one \+ Partner two/]);

  // Nobody is cast as either partner yet, and the page says so where it is fixed.
  await processional.getByRole("button", { name: /^2\. Partner one \+ Partner two/ }).click();
  await expect(page.getByText("No one is set as Partner one yet.")).toBeVisible();
});
