import type { Bar, BarKind, BarLine, Crowd, Figure, LineChoice, MixedPart, Pour, Shop } from "@/lib/model/types";
import { POURS } from "@/lib/model/types";
import { FIGURE_DEFAULTS, LINES, MIXES } from "./defaults";
import { mixOf } from "./sum";

/**
 * The Bar's changes, each a new bar. A choice equal to its default is not
 * kept, so putting a figure back and typing its default are the same thing.
 */

/** A figure changed, or put back with null. */
export function setFigure(bar: Bar, id: Figure, value: number | null): Bar {
  const { [id]: _, ...others } = bar.figures;
  const kept = value === null || value === FIGURE_DEFAULTS[id].value ? others : { ...others, [id]: Math.max(0, value) };
  return { ...bar, figures: kept };
}

/** A new kind of bar pours that kind's mix: any mix changed for the old kind goes. */
export function chooseKind(bar: Bar, kind: BarKind): Bar {
  return { ...bar, kind, mix: {} };
}

export function setCrowd(bar: Bar, crowd: Crowd): Bar {
  return { ...bar, crowd };
}

/** How many are coming, typed; null goes back to the guest list's count. */
export function setPeople(bar: Bar, people: number | null): Bar {
  return { ...bar, people: people === null ? null : Math.max(0, Math.round(people)) };
}

/** One pour's share of a part's mix. A mix back at the kind's is the kind's again. */
export function setShare(bar: Bar, part: MixedPart, pour: Pour, value: number): Bar {
  const mix = { ...mixOf(bar, part), [pour]: Math.max(0, value) };
  const kinds = MIXES[bar.kind][part];
  const { [part]: _, ...others } = bar.mix;
  return { ...bar, mix: POURS.every((p) => mix[p] === kinds[p]) ? others : { ...others, [part]: mix } };
}

/** A part's mix back to the kind's. */
export function resetMix(bar: Bar, part: MixedPart): Bar {
  const { [part]: _, ...others } = bar.mix;
  return { ...bar, mix: others };
}

function withLine(bar: Bar, line: BarLine, change: (choice: LineChoice) => LineChoice): Bar {
  const { [line]: current, ...others } = bar.lines;
  const next = change({ ...current });
  return { ...bar, lines: Object.keys(next).length > 0 ? { ...others, [line]: next } : others };
}

/** A line's price, or none. */
export function setPrice(bar: Bar, line: BarLine, price: number | null): Bar {
  return withLine(bar, line, ({ price: _, ...rest }) => (price === null ? rest : { ...rest, price: Math.max(0, price) }));
}

/** What they already have of a line; nothing is none. */
export function setHave(bar: Bar, line: BarLine, have: number | null): Bar {
  return withLine(bar, line, ({ have: _, ...rest }) => (have === null || have <= 0 ? rest : { ...rest, have }));
}

/** Where a line is bought; its usual shop is not kept. */
export function setShop(bar: Bar, line: BarLine, shop: Shop): Bar {
  return withLine(bar, line, ({ shop: _, ...rest }) => (shop === LINES[line].shop ? rest : { ...rest, shop }));
}

export function setWholeCases(bar: Bar, wholeCases: boolean): Bar {
  return { ...bar, wholeCases };
}

/** How many things the couple chose, for knowing whether a wedding holds any of it. */
export function choices(bar: Bar): number {
  return (
    Object.keys(bar.figures).length +
    Object.keys(bar.mix).length +
    Object.keys(bar.lines).length +
    (bar.people !== null ? 1 : 0) +
    (bar.kind !== "full" ? 1 : 0) +
    (bar.crowd !== "usual" ? 1 : 0) +
    (bar.wholeCases ? 0 : 1)
  );
}
