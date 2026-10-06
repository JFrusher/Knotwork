import type { Knotwork } from "@jfrusher/knotwork";
import { barSum } from "@/lib/bar/sum";
import { hiddenToolIds } from "@/lib/model/toolbox";

/**
 * What the Bar expects the drinks to cost, for the Money page: planned spend,
 * never committed or paid. Read from the Bar each time, never copied into the
 * crew slice, so it follows the guest count. Null when the Bar is hidden or
 * nothing in it has a price.
 */
export function drinksEstimate(doc: Knotwork): number | null {
  if (hiddenToolIds(doc).has("bar")) return null;
  const { spend } = barSum(doc);
  return spend > 0 ? spend : null;
}
