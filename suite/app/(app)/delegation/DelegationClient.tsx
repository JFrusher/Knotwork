"use client";

import dynamic from "next/dynamic";

import { WhenDocumentReady } from "@/components/shell/WhenDocumentReady";
import "@/apps/delegation/index.css";

/**
 * Delegation, rendered only in the browser.
 *
 * Like the other tools it was a single-page app, and it still behaves like one:
 * it reads the crew and the day out of the shared document before it can draw
 * anything, which a server cannot do.
 */
const App = dynamic(() => import("@/apps/delegation/App").then((m) => m.App), { ssr: false });

/**
 * The class carries Delegation's design tokens, which used to sit on `:root`. It is
 * here rather than inside the tool so that nothing in `apps/delegation` had to know
 * it stopped being the only app on the page.
 */
export function DelegationApp() {
  return (
    <div className="delegation-scope">
      <WhenDocumentReady>
        <App />
      </WhenDocumentReady>
    </div>
  );
}
