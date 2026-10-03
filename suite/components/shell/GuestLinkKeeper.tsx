"use client";

import { useEffect } from "react";
import { useGuestLink } from "@/lib/share/guestLink";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";

/** After the last edit, so an evening of seating republishes a few times, not hundreds. */
const REPUBLISH_DELAY_MS = 3000;

/**
 * Keeps a published guest link current, from whichever page is open: reads
 * the link once the wedding is known, then republishes a few seconds after
 * what guests would see changes. Nothing at all happens while there is no
 * link.
 */
export function GuestLinkKeeper() {
  const weddingId = useKnotworkStore((s) => s.weddingId);
  const load = useGuestLink((s) => s.load);

  useEffect(() => {
    if (weddingId) void load(weddingId);
  }, [weddingId, load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useKnotworkStore.subscribe((state, prev) => {
      if (state.doc === prev.doc || !useGuestLink.getState().link) return;
      clearTimeout(timer);
      timer = setTimeout(() => void useGuestLink.getState().keepCurrent(), REPUBLISH_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return null;
}
