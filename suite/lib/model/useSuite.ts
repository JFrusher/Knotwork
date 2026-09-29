"use client";

import { useCallback } from "react";
import type { Event as WeddingEvent, SliceName, Trousseau } from "@jfrusher/trousseau";
import {
  useTrousseauStore,
  type TrousseauState,
  type WriteOptions,
} from "@/lib/store/useTrousseauStore";
import {
  publishDay,
  readBoxes,
  readCast,
  readCeremony,
  readCrew,
  readGuests,
  readSeating,
  readShots,
  readTimeline,
  resolvedDay,
  timelineDoc,
} from "./slices";
import { coupleTitle } from "./partners";
import type { Boxes, CastSlice, Ceremony, Crew, Guest, Seating, Shots } from "./types";
import type { Timeline } from "./timeline";

/**
 * What every tool reads and writes.
 *
 * Each reader goes through the per-document cache in `slices`, so a selector
 * returns the same object until the document actually changes — which is what
 * keeps these safe to call from a render.
 */

export const useEvent = (): WeddingEvent => useTrousseauStore((s) => s.doc.event);
export const useGuests = (): Record<string, Guest> =>
  useTrousseauStore((s) => readGuests(s.doc));
export const useSeating = (): Seating => useTrousseauStore((s) => readSeating(s.doc));
export const useTimeline = (): Timeline => useTrousseauStore((s) => readTimeline(s.doc));
export const useCrew = (): Crew => useTrousseauStore((s) => readCrew(s.doc));
export const useShots = (): Shots => useTrousseauStore((s) => readShots(s.doc));
export const useCast = (): CastSlice => useTrousseauStore((s) => readCast(s.doc));
export const useCeremony = (): Ceremony => useTrousseauStore((s) => readCeremony(s.doc));
export const useBoxes = (): Boxes => useTrousseauStore((s) => readBoxes(s.doc));
export const useResolvedDay = () => useTrousseauStore((s) => resolvedDay(s.doc));
export const useTimelineDoc = () => useTrousseauStore((s) => timelineDoc(s.doc));
export const useStatus = (): TrousseauState["status"] => useTrousseauStore((s) => s.status);

/**
 * Every writer takes a `label`, which is what the undo tooltip says and what
 * consecutive edits coalesce on. An unlabelled write is still undoable — it
 * just reads as "change" and folds into nothing.
 */
/**
 * What changing the wedding's facts writes: the event, and the day resolved
 * from it. For `setEvent`, and for anything that commits the facts together
 * with other slices as one change — setup does.
 */
export function eventChange(doc: Trousseau, patch: Partial<WeddingEvent>): Array<[SliceName, unknown]> {
  const event = { ...doc.event, ...patch };
  // The title is the partners' names, written here and nowhere else, so the
  // two can never disagree.
  if (patch.partners) event.coupleNames = coupleTitle(patch.partners);
  // The curfew is an input to the resolver, so moving it moves the day.
  return [
    ["event", event],
    ["day", publishDay({ ...doc, event }, readTimeline(doc))],
  ];
}

export interface SuiteWriters {
  setEvent: (patch: Partial<WeddingEvent>, options?: WriteOptions) => void;
  setGuests: (next: Record<string, Guest>, options?: WriteOptions) => void;
  setSeating: (next: Seating, options?: WriteOptions) => void;
  /** Also republishes the resolved `day`, in the same change. */
  setTimeline: (next: Timeline, options?: WriteOptions) => void;
  setCrew: (next: Crew, options?: WriteOptions) => void;
  setShots: (next: Shots, options?: WriteOptions) => void;
  /** Who is who, shared by Group shots and Ceremony. */
  setCast: (next: CastSlice, options?: WriteOptions) => void;
  setCeremony: (next: Ceremony, options?: WriteOptions) => void;
  setBoxes: (next: Boxes, options?: WriteOptions) => void;
  /** Both halves of a seat, as one undo step. */
  setPlan: (
    guests: Record<string, Guest>,
    seating: Seating,
    options?: WriteOptions,
  ) => void;
}

export function useWriters(): SuiteWriters {
  const setSlice = useTrousseauStore((s) => s.setSlice);
  const setSlices = useTrousseauStore((s) => s.setSlices);

  const setEvent = useCallback(
    (patch: Partial<WeddingEvent>, options: WriteOptions = { label: "wedding details" }) => {
      setSlices(eventChange(useTrousseauStore.getState().doc, patch), options);
    },
    [setSlices],
  );

  const setTimeline = useCallback(
    (next: Timeline, options: WriteOptions = { label: "the day" }) => {
      const { doc } = useTrousseauStore.getState();
      setSlices(
        [
          ["timeline", next],
          ["day", publishDay(doc, next)],
        ],
        options,
      );
    },
    [setSlices],
  );

  const setGuests = useCallback(
    (next: Record<string, Guest>, options: WriteOptions = { label: "the guest list" }) =>
      setSlice("guests", next, options),
    [setSlice],
  );
  const setSeating = useCallback(
    (next: Seating, options: WriteOptions = { label: "the room" }) =>
      setSlice("seating", next, options),
    [setSlice],
  );
  const setCrew = useCallback(
    (next: Crew, options: WriteOptions = { label: "the crew" }) => setSlice("crew", next, options),
    [setSlice],
  );
  const setShots = useCallback(
    (next: Shots, options: WriteOptions = { label: "the group shots" }) =>
      setSlice("shots", next, options),
    [setSlice],
  );
  const setCast = useCallback(
    (next: CastSlice, options: WriteOptions = { label: "who is who" }) => setSlice("cast", next, options),
    [setSlice],
  );
  const setCeremony = useCallback(
    (next: Ceremony, options: WriteOptions = { label: "the processional" }) => setSlice("ceremony", next, options),
    [setSlice],
  );
  const setBoxes = useCallback(
    (next: Boxes, options: WriteOptions = { label: "the boxes" }) => setSlice("boxes", next, options),
    [setSlice],
  );
  const setPlan = useCallback(
    (
      guests: Record<string, Guest>,
      seating: Seating,
      options: WriteOptions = { label: "the seating" },
    ) =>
      setSlices(
        [
          ["guests", guests],
          ["seating", seating],
        ],
        options,
      ),
    [setSlices],
  );

  return { setEvent, setGuests, setSeating, setTimeline, setCrew, setShots, setCast, setCeremony, setBoxes, setPlan };
}
