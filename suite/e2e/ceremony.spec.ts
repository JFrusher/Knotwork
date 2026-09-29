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

  await page.getByRole("button", { name: "Undo changing the processional" }).click();
  await expect.poll(async () => (await order(page)).at(-1)).toBe("walk-couple");
});

test("a new wedding adds Ceremony from Tools and is given a starting order, and told who is missing", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Tools" });
  await tabs.getByRole("button", { name: "Add or remove tools" }).click();
  await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Add Ceremony" }).click();
  await page.keyboard.press("Escape");
  await tabs.getByRole("link", { name: "Ceremony" }).click();

  await page.getByRole("button", { name: "Suggest an order", exact: true }).click();
  const processional = page.getByRole("list", { name: "The processional" });
  await expect(processional.getByRole("listitem")).toHaveText([/1\. The officiant/, /2\. Partner one \+ Partner two/]);

  // Nobody is cast as either partner yet, and the page says so where it is fixed.
  await processional.getByRole("button", { name: /^2\. Partner one \+ Partner two/ }).click();
  await expect(page.getByText("No one is set as Partner one yet.")).toBeVisible();
});

test("the ceremony prints for the officiant, the musicians, the guests and the wedding party, and copies as text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedExampleWedding(page);
  await page.goto("/ceremony");
  const save = async (button: string) => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button, exact: true }).click()]);
    return download.suggestedFilename();
  };

  expect(await save("Running order")).toBe("alex-and-sam-running-order.pdf");
  expect(await save("Music")).toBe("alex-and-sam-music.pdf");
  expect(await save("Order of service")).toBe("alex-and-sam-order-of-service.pdf");
  expect(await save("Processional")).toBe("alex-and-sam-processional.pdf");

  await page.getByRole("button", { name: "Copy as text" }).click();
  await expect(page.getByText("Copied — paste it into an email to your officiant or the wedding party.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split("\n")[0]).toBe("The order of service — Alex & Sam");
  expect(copied).toContain("13:30  2. The processional (4 min)");
});

test("the order of service runs from the ceremony's block, and a piece's start is typed as minutes and seconds", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/ceremony");
  const order = page.getByRole("list", { name: "The order of service" });
  await expect(order.getByRole("listitem")).toHaveCount(12);
  await expect(order.getByRole("listitem").nth(1)).toContainText("13:30");
  await expect(page.getByText("36 min of 45")).toBeVisible();

  // The example's one piece still to be approved by the registrar, said where the ceremony is.
  await expect(page.getByRole("list", { name: "Still to do" })).toContainText("1 reading or piece of music not yet approved by the registrar.");

  await order.getByRole("button", { name: /\d+\. Signing the register/ }).click();
  const start = page.getByRole("textbox", { name: "Start the track at" });
  await start.fill("soon");
  await start.press("Enter");
  await expect(page.getByText("Type it as minutes and seconds, like 0:45.")).toBeVisible();
  await start.fill("1:05");
  await start.press("Enter");
  type Stored = { id: string; song: { startSec: number } };
  await expect
    .poll(async () => ((await storedDocument(page)).ceremony.order as Stored[]).find((moment) => moment.id === "moment-signing")?.song.startSec)
    .toBe(65);
});

test("a new wedding's civil ceremony starts from the registrar's order, with the processional in it", async ({ page }) => {
  await page.goto("/");
  await page.goto("/ceremony");
  await page.getByRole("button", { name: "Suggest an order of service" }).click();
  const order = page.getByRole("list", { name: "The order of service" });
  await expect(order).toContainText("The processional");
  await expect(order).toContainText("The declaratory words");
  await expect(order).toContainText("Signing the register");
});

test("the Timeline shows the ceremony's order and music inside its block, and the way to Ceremony", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/timeline");
  await page.getByRole("button", { name: /^Ceremony, / }).click();
  await expect(page.getByRole("list", { name: "The music cues" })).toContainText("Clair de Lune");
  await expect(page.getByRole("list", { name: "The music cues" })).toContainText("cue: The music changes as the couple enter");
  await expect(page.getByRole("list", { name: "The order of service" })).toContainText("13:30 The processional");
  await page.getByRole("link", { name: "Plan it in Ceremony" }).click();
  await expect(page).toHaveURL(/\/ceremony$/);
});
