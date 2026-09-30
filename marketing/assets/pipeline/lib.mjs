import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
export const BASE = process.env.BASE || 'http://localhost:3100';
export const OUT = fileURLToPath(new URL('../screenshots', import.meta.url));

export async function launch() { return chromium.launch({ args: ['--lang=en-GB'] }); }

/** A page in its own context, the example wedding stored where the app reads it. */
export async function weddingPage(browser, { width = 1440, height = 900, scale = 2, video = null, time = null, init = null } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: scale, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'light',
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  if (init) await page.addInitScript(init);
  if (time) await page.clock.setFixedTime(new Date(time));
  await page.goto(BASE + '/');
  await page.evaluate(async () => {
    const wedding = await (await fetch('/fixtures/example-wedding.trousseau.json')).json();
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('keyval-store');
      open.onupgradeneeded = () => open.result.createObjectStore('keyval');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(wedding, 'trousseau.document');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  return { context, page };
}

/** Somewhere a few weeks before the example wedding, mid-morning at the venue. */
export const PLANNING_TIME = '2028-04-18T09:30:00+01:00';
export async function settle(page, ms = 1200) { await page.waitForLoadState('networkidle'); await page.waitForTimeout(ms); }
