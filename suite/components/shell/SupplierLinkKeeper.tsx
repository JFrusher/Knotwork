"use client";

import { useEffect } from "react";
import { useSupplierLinks } from "@/lib/suppliers/links";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";

/** After the last edit, so an evening on the running order republishes a few times, not hundreds. */
const REPUBLISH_DELAY_MS = 3000;

/**
 * Keeps suppliers' links current, from whichever page is open: reads them —
 * and any confirmations — once the wedding is known, then republishes a few
 * seconds after a change. Nothing at all happens while there are none.
 */
export function SupplierLinkKeeper() {
  const weddingId = useTrousseauStore((s) => s.weddingId);
  const load = useSupplierLinks((s) => s.load);

  useEffect(() => {
    if (weddingId) void load(weddingId);
  }, [weddingId, load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useTrousseauStore.subscribe((state, prev) => {
      if (state.doc === prev.doc || !useSupplierLinks.getState().links?.length) return;
      clearTimeout(timer);
      timer = setTimeout(() => void useSupplierLinks.getState().keepCurrent(), REPUBLISH_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return null;
}
