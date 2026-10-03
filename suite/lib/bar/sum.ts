import type { Knotwork } from "@jfrusher/knotwork";
import { cached, isComing, readBar, readGuests } from "@/lib/model/slices";
import type { Bar, BarLine, Figure, Mix, MixedPart, Pour, Shop } from "@/lib/model/types";
import { BAR_LINES, POURS } from "@/lib/model/types";
import { BOTTLE_ML, CROWD_FACTORS, FIGURE_DEFAULTS, LINES, MIXES, SPIRIT_BOTTLE_ML } from "./defaults";

/**
 * How much to buy, worked out every time from who is coming and the figures —
 * never stored, so a guest saying no changes the wine.
 *
 * Kept fractional to the end: each line is rounded up once, to what a shop
 * sells, so rounding never compounds.
 */

/** A figure as the couple left it: their own, or the default. */
export const figure = (bar: Bar, id: Figure): number => bar.figures[id] ?? FIGURE_DEFAULTS[id].value;

/** A part's mix: the couple's own, or their kind of bar's. */
export const mixOf = (bar: Bar, part: MixedPart): Mix => bar.mix[part] ?? MIXES[bar.kind][part];

/** A line's name, alcohol-free at a no and low bar. */
export const lineName = (bar: Bar, line: BarLine): string =>
  bar.kind === "no-and-low" ? (LINES[line].alcoholFree ?? LINES[line].name) : LINES[line].name;

export type Part = "reception" | "toast" | "meal" | "evening";

export interface Heads {
  /** Everyone on the guest list who has not said no. */
  listed: number;
  /** Who the day is bought for: the list's count, or the couple's own. */
  people: number;
  typed: boolean;
  /** Coming for the evening only. */
  evening: number;
  /** Of everyone there in the evening, drinking alcohol. Rounded, for reading. */
  drinking: number;
  notDrinking: number;
}

export interface LineSum {
  line: BarLine;
  name: string;
  /** Exactly what the figures come to, in the line's units. */
  needed: number;
  have: number;
  /** Whole units still to buy: after what they have, and whole cases if they chose. */
  buy: number;
  price: number | null;
  /** What `buy` costs, or null with no price. */
  cost: number | null;
  shop: Shop;
}

export interface BarSum {
  heads: Heads;
  /** Drinks each, for those drinking alcohol, the crowd allowed for. */
  each: Record<Part, number>;
  lines: LineSum[];
  /** What the priced lines cost. */
  spend: number;
  /** Lines to buy with no price, left out of `spend`. */
  unpriced: number;
}

/** Each pour's share of a mix, as a fraction of the whole, so shares need not add to 100. */
function shares(mix: Mix): Mix {
  const total = POURS.reduce((sum, pour) => sum + mix[pour], 0);
  const out = {} as Mix;
  for (const pour of POURS) out[pour] = total > 0 ? mix[pour] / total : 0;
  return out;
}

export function sumBar(bar: Bar, listed: number): BarSum {
  const f = (id: Figure) => figure(bar, id);
  const people = bar.people ?? listed;
  const evening = f("eveningGuests");
  const everyone = people + evening;
  const notShare = Math.min(100, f("notDrinkingPct")) / 100;
  const crowd = CROWD_FACTORS[bar.crowd];

  const base: Record<Part, number> = {
    reception: f("receptionHours") * f("receptionPerHour"),
    toast: f("toastGlasses"),
    meal: f("mealGlasses"),
    evening: f("eveningHours") * f("eveningPerHour"),
  };
  const each: Record<Part, number> = {
    reception: base.reception * crowd,
    toast: base.toast,
    meal: base.meal * crowd,
    evening: base.evening * crowd,
  };

  const dayDrinking = people * (1 - notShare);
  const allDrinking = everyone * (1 - notShare);
  const reception = dayDrinking * each.reception;
  const eveningDrinks = allDrinking * each.evening;
  const atReception = shares(mixOf(bar, "reception"));
  const inEvening = shares(mixOf(bar, "evening"));
  const poured: Record<Pour, number> = {
    fizz: reception * atReception.fizz + dayDrinking * each.toast + eveningDrinks * inEvening.fizz,
    wine: reception * atReception.wine + dayDrinking * each.meal + eveningDrinks * inEvening.wine,
    beer: reception * atReception.beer + eveningDrinks * inEvening.beer,
    spirit: reception * atReception.spirit + eveningDrinks * inEvening.spirit,
  };
  // Those not drinking alcohol have a soft drink for each drink, at the usual rate.
  const soft = people * notShare * (base.reception + base.toast + base.meal) + everyone * notShare * base.evening;

  const wineBottles = (poured.wine * f("wineGlassMl")) / BOTTLE_ML;
  const red = Math.min(100, f("redPct")) / 100;
  const needed: Record<BarLine, number> = {
    fizz: (poured.fizz * f("fizzGlassMl")) / BOTTLE_ML,
    white: wineBottles * (1 - red),
    red: wineBottles * red,
    beer: poured.beer,
    spirits: (poured.spirit * f("spiritMl")) / SPIRIT_BOTTLE_ML,
    mixers: (poured.spirit * f("mixerMl")) / 1000,
    soft: (soft * f("softMl")) / 1000,
    ice: everyone * f("iceKg"),
  };

  const lines = BAR_LINES.map((line): LineSum => {
    const info = LINES[line];
    const choice = bar.lines[line] ?? {};
    const have = choice.have ?? 0;
    // A hair under a whole unit is that unit: 42.0000001 bottles is 42.
    let buy = Math.max(0, Math.ceil(needed[line] - have - 1e-9));
    if (bar.wholeCases && info.caseOf > 1) buy = Math.ceil(buy / info.caseOf) * info.caseOf;
    const price = choice.price ?? null;
    return {
      line,
      name: lineName(bar, line),
      needed: needed[line],
      have,
      buy,
      price,
      cost: price === null ? null : (buy / info.pricedPer) * price,
      shop: choice.shop ?? info.shop,
    };
  });

  return {
    heads: {
      listed,
      people,
      typed: bar.people !== null,
      evening,
      drinking: Math.round(allDrinking),
      notDrinking: Math.round(everyone * notShare),
    },
    each,
    lines,
    spend: lines.reduce((sum, line) => sum + (line.cost ?? 0), 0),
    unpriced: lines.filter((line) => line.buy > 0 && line.price === null).length,
  };
}

/** The wedding's bar, worked out from its guest list. Cached per document, for selectors. */
export function barSum(doc: Knotwork): BarSum {
  return cached(doc, "barSum", () => {
    const listed = Object.values(readGuests(doc)).filter(isComing).length;
    return sumBar(readBar(doc), listed);
  });
}
