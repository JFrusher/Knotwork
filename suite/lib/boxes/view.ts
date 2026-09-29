import type { Trousseau } from "@jfrusher/trousseau";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { cached, readTimeline, resolvedDay } from "@/lib/model/slices";
import type { Box, BoxItem, Boxes } from "@/lib/model/types";

/** Where and when a block of the day is: what a box needed at it is labelled with. */
export interface Place {
  label: string;
  location: string;
  startMin: number;
}

/** Every block of the day by id, with where it is and when it starts. */
export function dayPlaces(doc: Trousseau): ReadonlyMap<string, Place> {
  return cached(doc, "boxPlaces", () => {
    const starts = new Map(resolvedDay(doc).map((block) => [block.id, block.startMin]));
    return new Map(
      readTimeline(doc)
        .blocks.filter((block) => starts.has(block.id))
        .map((block) => [block.id, { label: block.label, location: block.location.trim(), startMin: starts.get(block.id)! }]),
    );
  });
}

/**
 * Where a box is going and by when: its block's, or nothing for a box not for
 * the day, or `lost` for one whose block the day no longer has.
 */
export function neededAt(box: Box, known: ReadonlyMap<string, Place>): { place: Place | null; lost: boolean } {
  if (box.blockId === null) return { place: null, lost: false };
  const place = known.get(box.blockId) ?? null;
  return { place, lost: place === null };
}

/** "The suite, by 08:00", or why there is no saying: the page, the labels and the list all say it so. */
export function whereBy(place: Place | null, lost: boolean): string {
  if (lost) return "Its part of the day is no longer on the Timeline";
  if (!place) return "Not for the day";
  return `${place.location || place.label}, by ${formatClock(place.startMin)}`;
}

/** Things packed and things in the box, counted by line, not by how many of each. */
export function packing(box: Pick<Box, "items">): { packed: number; total: number } {
  return { packed: box.items.filter((item) => item.packed).length, total: box.items.length };
}

/** Every box's packing together. */
export function packingOf(boxes: Boxes): { packed: number; total: number } {
  return boxes.boxes.reduce(
    (sum, box) => {
      const one = packing(box);
      return { packed: sum.packed + one.packed, total: sum.total + one.total };
    },
    { packed: 0, total: 0 },
  );
}

export interface Found {
  box: Box;
  /** The thing that matched, or null when it was the box's own name. */
  item: BoxItem | null;
}

/** "Shoes" → the box they are in. Every word must be in the thing, whatever the case. */
export function find(boxes: Boxes, query: string): Found[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  return boxes.boxes.flatMap((box) => [
    ...(matches(box.name) ? [{ box, item: null }] : []),
    ...box.items.filter((item) => matches(item.label)).map((item) => ({ box, item })),
  ]);
}
