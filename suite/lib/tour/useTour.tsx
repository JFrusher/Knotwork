"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { hiddenToolIds } from "@/lib/model/toolbox";
import { CHAPTERS, type ChapterId, type TourChapter, type TourStep } from "./steps";

/**
 * Which chapter and step are open.
 *
 * Held in a context mounted in `app/(app)/layout.tsx`, which persists across
 * client-side navigation — so a chapter that moves the user from Seating to
 * Timeline keeps its place without any extra machinery.
 */

const SEEN_KEY = "trousseau.tour.seen";

/** Storage can throw outright in a private window, so every touch is wrapped. */
function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // A browser refusing storage means the tour is offered again next time,
    // which is a far better failure than not opening at all.
  }
}

export interface TourState {
  /** Null when the tour is closed. */
  step: TourStep | null;
  chapterTitle: string;
  /** One-based, for "3 of 5". */
  index: number;
  total: number;
  /** One chapter: "How this page works". */
  start: (chapter: ChapterId) => void;
  /** Every chapter, one after another: "Take a tour". */
  startAll: () => void;
  next: () => void;
  back: () => void;
  stop: () => void;
  hasSeenTour: boolean;
}

const TourContext = createContext<TourState | null>(null);

/** A walk through the tour: its steps in order, each with the chapter it belongs to. */
type Walk = Array<{ chapter: TourChapter; step: TourStep }>;

const walkOf = (chapters: readonly TourChapter[]): Walk =>
  chapters.flatMap((chapter) => chapter.steps.map((step) => ({ chapter, step })));

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // "How this page works" walks one chapter and stops — somebody who asked
  // about Place cards asked about Place cards. "Take a tour" walks them all.
  const [open, setOpen] = useState<{ walk: Walk; index: number } | null>(null);
  const [seen, setSeen] = useState(false);
  const at = open ? open.walk[open.index] : undefined;

  const go = useCallback(
    (next: { walk: Walk; index: number } | null) => {
      const target = next?.walk[next.index];
      setOpen(target ? next : null);
      // Steps carry their own route so a walk can move between tools.
      if (target && window.location.pathname !== target.step.route) router.push(target.step.route);
    },
    [router],
  );

  const begin = useCallback(
    (walk: Walk) => {
      setSeen(true);
      writeSeen();
      go({ walk, index: 0 });
    },
    [go],
  );
  const start = useCallback(
    (id: ChapterId) => begin(walkOf(CHAPTERS.filter((chapter) => chapter.id === id))),
    [begin],
  );
  // Every chapter but those of the tools the wedding has removed.
  const hidden = useTrousseauStore((s) => hiddenToolIds(s.doc));
  const startAll = useCallback(
    () => begin(walkOf(CHAPTERS.filter((chapter) => !hidden.has(chapter.id)))),
    [begin, hidden],
  );

  const next = useCallback(() => {
    if (open) go({ walk: open.walk, index: open.index + 1 });
  }, [go, open]);

  const back = useCallback(() => {
    if (open && open.index > 0) go({ walk: open.walk, index: open.index - 1 });
  }, [go, open]);

  const stop = useCallback(() => go(null), [go]);

  const value = useMemo<TourState>(
    () => ({
      step: at?.step ?? null,
      chapterTitle: at?.chapter.title ?? "",
      index: (open?.index ?? 0) + 1,
      total: open?.walk.length ?? 0,
      start,
      startAll,
      next,
      back,
      stop,
      hasSeenTour: seen || (typeof window !== "undefined" && readSeen()),
    }),
    [at, back, next, open, seen, start, startAll, stop],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/** Throws outside the provider, which is a wiring mistake rather than a user-facing one. */
export function useTour(): TourState {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour must be used inside <TourProvider>");
  return value;
}
