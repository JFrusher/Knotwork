"use client";

import dynamic from "next/dynamic";

import { WhenDocumentReady } from "@/components/shell/WhenDocumentReady";

import "@/apps/stationery/index.css";

/**
 * Stationery, rendered only in the browser.
 *
 * It was a single-page app before it came here, and it still behaves like one:
 * the first thing it does is read the autosave out of the shared document and
 * measure the window, neither of which a server can do. Rendering it on the
 * server produced markup that disagreed with the client on the first paint —
 * the editor from the server, the small-screen notice from the browser — which
 * React then had to throw away and rebuild.
 *
 * Skipping the server render is not a workaround for that mismatch so much as
 * an admission that there was never anything for the server to say. Nothing is
 * lost: this page has no content to index, and every pixel of it depends on
 * data that lives on this device.
 */
const App = dynamic(() => import("@/apps/stationery/App").then((m) => m.App), { ssr: false });

/**
 * The class carries Stationery's design tokens, which used to sit on `:root`. It is
 * here rather than inside the tool so that nothing in `apps/stationery` had to know
 * it stopped being the only app on the page.
 */
export function StationeryApp() {
  return (
    <div className="stationery-scope">
      <WhenDocumentReady>
        <App />
      </WhenDocumentReady>
    </div>
  );
}
