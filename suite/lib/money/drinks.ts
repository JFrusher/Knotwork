import type { Knotwork } from "@jfrusher/knotwork";
import { barSum } from "@/lib/bar/sum";
import { hiddenToolIds } from "@/lib/model/toolbox";

/**
 * What the Bar estimates the drinks will cost, for Money to count as planned
 * spend: never committed, never paid, and never copied into the crew slice,
 * where it would go stale the moment a guest said no.
 *
 * Null when the Bar is hidden, or nothing in it has a price yet.
 */
export function drinksEstimate(doc: Knotwork): number | null {
  if (hiddenToolIds(doc).has("bar")) return null;
  const { spend } = barSum(doc);
  return spend > 0 ? spend : null;
}
