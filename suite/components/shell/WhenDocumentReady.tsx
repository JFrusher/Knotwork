"use client";

import { useKnotworkStore } from "@/lib/store/useKnotworkStore";

/**
 * Holds a tool back until the stored wedding has actually been read.
 *
 * The document is loaded from IndexedDB by an effect, so for the first moments
 * after the page appears the store is empty but perfectly willing to answer
 * questions about itself. A tool mounted into that window sees a wedding with
 * nothing in it, and anything it does from there acts on nothing.
 *
 * Each tool is loaded as its own chunk, so whether it arrives before or after
 * the document is a race between a network fetch and a database read. Nothing
 * here should depend on who wins.
 *
 * That is all it does. The tools keep no copy of the wedding, so a document
 * replaced or changed underneath one — a restore, the Data panel, a partner's
 * edit — is simply what it shows next, with nothing to remount.
 */
export function WhenDocumentReady({ children }: { children: React.ReactNode }) {
  const status = useKnotworkStore((s) => s.status);
  const error = useKnotworkStore((s) => s.error);

  if (status === "error") {
    return (
      <p role="alert" className="p-6 text-sm text-slate">
        {error ?? "The saved wedding could not be read."}
      </p>
    );
  }

  // Deliberately blank rather than a spinner: this is a local database read,
  // over in a frame or two, and a flash of loading text is worse than nothing.
  if (status !== "ready") return null;

  return <>{children}</>;
}
