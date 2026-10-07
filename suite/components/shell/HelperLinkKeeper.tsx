"use client";

import { useEffect } from "react";
import { useHelperLinks } from "@/lib/helpers/links";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";

/** After the last edit, so an evening on the running order republishes a few times, not hundreds. */
const REPUBLISH_DELAY_MS = 3000;

/**
 * Keeps helpers' links current, from whichever page is open: reads them once
 * the wedding is known, then republishes a few seconds after a change.
 * Nothing at all happens while there are none.
 */
export function HelperLinkKeeper() {
  const weddingId = useKnotworkStore((s) => s.weddingId);
  const load = useHelperLinks((s) => s.load);

  useEffect(() => {
    if (weddingId) void load(weddingId);
  }, [weddingId, load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useKnotworkStore.subscribe((state, prev) => {
      if (state.doc === prev.doc || !useHelperLinks.getState().links?.length) return;
      clearTimeout(timer);
      timer = setTimeout(() => void useHelperLinks.getState().keepCurrent(), REPUBLISH_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return null;
}
