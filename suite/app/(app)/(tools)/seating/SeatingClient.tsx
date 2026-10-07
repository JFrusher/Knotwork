"use client";

import dynamic from "next/dynamic";

import { WhenDocumentReady } from "@/components/shell/WhenDocumentReady";
import "@/apps/seating/styles/tokens.css";
import "@/apps/seating/styles/global.css";

/**
 * Seating, rendered only in the browser.
 *
 * It reads the plan out of the shared document and measures the canvas before
 * it can draw anything, neither of which a server can do.
 */
const App = dynamic(() => import("@/apps/seating/App"), { ssr: false });

/**
 * The class carries Seating's design tokens and its reset, both of which used
 * to apply to the whole document. It is here rather than inside the tool so
 * that nothing in `apps/seating` had to know it stopped being the only app on
 * the page.
 */
export function SeatingApp() {
  return (
    <div className="seating-scope">
      <WhenDocumentReady>
        <App />
      </WhenDocumentReady>
    </div>
  );
}
