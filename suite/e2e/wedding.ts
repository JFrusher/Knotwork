import { expect, type Page } from "@playwright/test";

/**
 * Puts the example wedding in this browser's storage, where the app reads it
 * on load: 100 guests, 13 tables, a day of 27 blocks.
 */
export async function seedExampleWedding(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    const wedding = await (await fetch("/fixtures/example-wedding.trousseau.json")).json();
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("keyval-store");
      open.onupgradeneeded = () => open.result.createObjectStore("keyval");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(wedding, "trousseau.document");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });
}

/** Opens Seating and waits for the room to be drawn. */
export async function openSeating(page: Page): Promise<void> {
  await page.goto("/seating");
  await expect(page.getByRole("button", { name: /^Table 1, / })).toBeVisible();
}

/** The count Seating's guest panel shows, e.g. 99 of "100 guests · 99 unassigned". */
export async function unassignedCount(page: Page): Promise<number> {
  const text = await page.getByText(/\d+ guests · \d+ unassigned/).first().textContent();
  return Number(/(\d+) unassigned/.exec(text ?? "")?.[1]);
}
