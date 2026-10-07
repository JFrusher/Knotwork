"use client";

import dynamic from "next/dynamic";

import { WhenDocumentReady } from "@/components/shell/WhenDocumentReady";

import "@/apps/timeline/index.css";

/**
 * Timeline, rendered only in the browser.
 *
 * Like the other tools it was a single-page app, and it still behaves like one:
 * it reads the day out of the shared document and measures the window before it
 * can draw anything, neither of which a server can do. There is nothing here for
 * a server to say, and saying it anyway only produced markup the browser threw
 * away on the first paint.
 */
const App = dynamic(() => import("@/apps/timeline/App").then((m) => m.App), { ssr: false });

/**
 * The class carries Timeline's design tokens, which used to sit on `:root`. It is
 * here rather than inside the tool so that nothing in `apps/timeline` had to know
 * it stopped being the only app on the page.
 */
export function TimelineApp() {
  return (
    <div className="timeline-scope">
      <WhenDocumentReady>
        <App />
      </WhenDocumentReady>
    </div>
  );
}
