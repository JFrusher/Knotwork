"use client";

import { useEffect } from "react";
import { reconcileLoadedDocument } from "@/lib/seating/normalise";
import { useKnotworkStore } from "./useKnotworkStore";

/**
 * Reads the stored wedding once, on the client.
 *
 * A component rather than a module side effect because IndexedDB does not
 * exist while Next prerenders, and zustand's `persist` middleware would reach
 * for it at import time.
 */
export function StoreHydrator() {
  const hydrate = useKnotworkStore((s) => s.hydrate);
  const startCloudSync = useKnotworkStore((s) => s.startCloudSync);
  useEffect(() => {
    // Cloud sync starts only after the local read has finished. Starting them
    // together would race the two documents, and the local one is what the
    // user already has on this device.
    void hydrate()
      .then(reconcileLoadedDocument)
      .then(() => startCloudSync());
  }, [hydrate, startCloudSync]);

  useEffect(() => {
    // Guarded the same way `persist` is: this file is imported by
    // tests that run without a `window`.
    if (typeof window === "undefined") return;
    const onOnline = () => void useKnotworkStore.getState().syncToCloud();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Nothing polls: `LiveWedding` hears each save as it lands. Coming back
    // to the tab still looks, since a browser may have put a background tab's
    // connection to sleep, and a save made then was not heard.
    const onVisible = () => {
      if (document.visibilityState === "visible") void useKnotworkStore.getState().pullFromCloud();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
