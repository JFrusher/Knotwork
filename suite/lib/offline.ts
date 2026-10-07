/**
 * Keep the page open at `scope` for when there is no signal: register the
 * worker that serves it offline (`public/binder-sw.js`), and hand it every
 * file this page loaded, so a reload with no signal has all of them. What the
 * page shows must already be on the phone, in the browser's own storage: the
 * worker never keeps anything from `/api/`.
 */
export async function keepForOffline(scope: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/binder-sw.js", { scope });
    const ready = await navigator.serviceWorker.ready;
    const files = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => new URL(url).origin === location.origin && !new URL(url).pathname.startsWith("/api/"));
    ready.active?.postMessage({ keep: [location.pathname, ...files] });
  } catch {
    // Without a worker the page still works; it just needs signal to open.
  }
}
