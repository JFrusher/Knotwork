"use client";

import { useMemo, type ReactNode } from "react";
import { hasContent, summarise } from "@/lib/model/content";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { Welcome } from "./Welcome";

/**
 * The welcome while the wedding is empty; the dashboard from the moment it is
 * not. Decided only once the stored wedding has been read — before then, an
 * empty document is just one that has not loaded yet.
 */
export function FrontPage({ dashboard }: { dashboard: ReactNode }) {
  const status = useKnotworkStore((s) => s.status);
  const raw = useKnotworkStore((s) => s.raw);
  // Only once ready: an unreadable wedding is kept as it was found, and
  // summarising it would throw — the dashboard is where that is reported.
  const empty = useMemo(() => status === "ready" && !hasContent(summarise(raw)), [status, raw]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="h-20 animate-pulse rounded-lg bg-stone" />
        <div className="mt-10 h-40 animate-pulse rounded-lg bg-stone" />
      </div>
    );
  }
  if (empty) return <Welcome />;
  return dashboard;
}
