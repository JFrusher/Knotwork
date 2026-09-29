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

interface StoredWedding {
  guests: number;
  tables: string[];
  names: string;
}

/**
 * The wedding as this browser has stored it — what a reload will read.
 *
 * For waiting until an edit has actually landed, rather than reloading into
 * the moment the last one is still on its way to IndexedDB.
 */
export async function storedWedding(page: Page): Promise<StoredWedding> {
  return page.evaluate(
    () =>
      new Promise<StoredWedding>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const read = open.result
            .transaction("keyval")
            .objectStore("keyval")
            .get("trousseau.document");
          read.onerror = () => reject(read.error);
          read.onsuccess = () => {
            const wedding = read.result ?? {};
            resolve({
              guests: Object.keys(wedding.guests ?? {}).length,
              tables: Object.values(wedding.seating?.tables ?? {}).map(
                (table) => (table as { label: string }).label,
              ),
              names: wedding.event?.coupleNames ?? "",
            });
          };
        };
      }),
  );
}

/** The stored document itself, for a test that needs a field `storedWedding` does not report. */
export async function storedDocument(page: Page): Promise<Record<string, any>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, any>>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const read = open.result.transaction("keyval").objectStore("keyval").get("trousseau.document");
          read.onerror = () => reject(read.error);
          read.onsuccess = () => resolve(read.result ?? {});
        };
      }),
  );
}
