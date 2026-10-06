import type { Knotwork } from "@jfrusher/knotwork";
import { dayPlaces, readBar } from "@/lib/model/slices";
import { hiddenToolIds } from "@/lib/model/toolbox";
import type { MixedPart } from "@/lib/model/types";

interface FromTheDay {
  /** Hours from the first block's start to the last one's end, or null to use the typed figure. */
  hours: number | null;
  /** A picked block is no longer on the Timeline, as Boxes says of a box's block. */
  lost: boolean;
}

/**
 * The reception's and the evening's hours as the Timeline has them, for the
 * blocks the couple picked. Read each time, so moving or resizing a block
 * changes the Bar with no edit there. Typed hours stand while nothing is
 * picked, a picked block is gone, or the Timeline is hidden.
 */
export function hoursFromTheDay(doc: Knotwork): Record<MixedPart, FromTheDay> {
  const { spans } = readBar(doc);
  const hidden = hiddenToolIds(doc).has("timeline");
  const places = dayPlaces(doc);
  const read = (part: MixedPart): FromTheDay => {
    const span = spans[part];
    if (!span || hidden) return { hours: null, lost: false };
    const from = places.get(span.from);
    const to = places.get(span.to);
    if (!from || !to) return { hours: null, lost: true };
    return { hours: Math.max(0, to.endMin - from.startMin) / 60, lost: false };
  };
  return { reception: read("reception"), evening: read("evening") };
}
