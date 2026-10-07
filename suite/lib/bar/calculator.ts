import { extract } from "@/lib/library/items";
import { emptyBar } from "@/lib/model/slices";
import type { Bar } from "@/lib/model/types";
import { sumBar, type BarSum } from "./sum";

/**
 * The public drinks calculator: the Bar's own sum, with a typed head count
 * instead of a guest list, and nothing kept anywhere.
 */
export const startingBar = (): Bar => ({ ...emptyBar(), people: 100 });

export const calculatorSum = (bar: Bar): BarSum => sumBar(bar, 0);

const KEY = "#from-calculator=";

/** The Bar, with the calculator's settings in the address for it to offer. */
export const barHref = (bar: Bar): string => `/bar${KEY}${encodeURIComponent(JSON.stringify(bar))}`;

/**
 * The settings an address carries, read as the library reads a kept Bar: only
 * what the Bar knows, and never the head count, which is the wedding's own.
 * An untouched calculator carries the defaults, so using it puts them back.
 */
export function fromCalculator(hash: string): Record<string, unknown> | null {
  if (!hash.startsWith(KEY)) return null;
  let bar: unknown;
  try {
    bar = JSON.parse(decodeURIComponent(hash.slice(KEY.length)));
  } catch {
    return null;
  }
  if (typeof bar !== "object" || bar === null || Array.isArray(bar)) return null;
  const { kind, crowd, figures, mix, lines, wholeCases } = emptyBar();
  return extract("bar", { bar }) ?? { kind, crowd, figures, mix, lines, wholeCases };
}
