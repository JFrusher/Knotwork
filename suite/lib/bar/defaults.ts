import type { BarKind, BarLine, Crowd, Figure, MixedPart, Mix, Shop } from "@/lib/model/types";

/**
 * Every default the Bar starts from, in one place, as agreed with the
 * maintainer on 2026-09-29 (docs/superpowers/plans/2026-09-29-bar.md). UK
 * first: 75cl bottles, 70cl spirits, 25ml measures, cases of 6 and 24.
 *
 * For 100 coming they give 42 bottles of fizz, 36 of white and 36 of red,
 * 9 cases of beer, 3 bottles of spirits, 10 litres of mixers, 50 of soft
 * drinks and 100kg of ice — pinned in `sum.test.ts`, so a change here is seen.
 */

export interface FigureInfo {
  value: number;
  label: string;
  /** After the number: "%", "hours", "ml". */
  unit: string;
  step: number;
}

export const FIGURE_DEFAULTS: Record<Figure, FigureInfo> = {
  notDrinkingPct: { value: 20, label: "Not drinking alcohol", unit: "%", step: 1 },
  eveningGuests: { value: 0, label: "Coming for the evening only", unit: "people", step: 1 },
  receptionHours: { value: 2, label: "Hours of the drinks reception", unit: "hours", step: 0.25 },
  receptionPerHour: { value: 1.5, label: "Drinks an hour at the reception", unit: "each", step: 0.25 },
  toastGlasses: { value: 1, label: "Glasses for the toast", unit: "each", step: 1 },
  mealGlasses: { value: 2, label: "Glasses of wine with the meal", unit: "each", step: 0.5 },
  eveningHours: { value: 4, label: "Hours of the evening bar", unit: "hours", step: 0.25 },
  eveningPerHour: { value: 1, label: "Drinks an hour in the evening", unit: "each", step: 0.25 },
  redPct: { value: 50, label: "Of the wine, red", unit: "%", step: 5 },
  fizzGlassMl: { value: 125, label: "A glass of fizz", unit: "ml", step: 5 },
  wineGlassMl: { value: 175, label: "A glass of wine", unit: "ml", step: 5 },
  spiritMl: { value: 25, label: "A spirit measure", unit: "ml", step: 5 },
  mixerMl: { value: 150, label: "Mixer with each spirit", unit: "ml", step: 10 },
  softMl: { value: 250, label: "A soft drink", unit: "ml", step: 10 },
  iceKg: { value: 1, label: "Ice for each person", unit: "kg", step: 0.25 },
};

export const KIND_NAMES: Record<BarKind, string> = {
  full: "Full bar",
  "beer-and-wine": "Beer and wine",
  cocktails: "Signature cocktails, beer and wine",
  "no-and-low": "No and low",
};

/** What each kind pours at the reception and in the evening, in percent. */
export const MIXES: Record<BarKind, Record<MixedPart, Mix>> = {
  full: {
    reception: { fizz: 70, wine: 0, beer: 30, spirit: 0 },
    evening: { fizz: 0, wine: 40, beer: 40, spirit: 20 },
  },
  "beer-and-wine": {
    reception: { fizz: 70, wine: 0, beer: 30, spirit: 0 },
    evening: { fizz: 0, wine: 50, beer: 50, spirit: 0 },
  },
  cocktails: {
    reception: { fizz: 0, wine: 0, beer: 30, spirit: 70 },
    evening: { fizz: 0, wine: 40, beer: 40, spirit: 20 },
  },
  "no-and-low": {
    reception: { fizz: 70, wine: 0, beer: 30, spirit: 0 },
    evening: { fizz: 0, wine: 50, beer: 50, spirit: 0 },
  },
};

/** A lighter crowd drinks a fifth less, a heavier one a fifth more. The toast is one glass whoever raises it. */
export const CROWD_FACTORS: Record<Crowd, number> = { lighter: 0.8, usual: 1, heavier: 1.2 };

export const CROWD_NAMES: Record<Crowd, string> = {
  lighter: "Lighter than most",
  usual: "Most crowds",
  heavier: "Heavier than most",
};

export interface LineInfo {
  name: string;
  /** What one of the line's units is: "bottle", "litre". */
  unit: string;
  units: string;
  /** Rounded up to these on sale or return; 1 where a line is not sold by the case. */
  caseOf: number;
  /** How many units a price is for: a case of beer is priced whole. */
  pricedPer: number;
  /** "a bottle", "a case of 24". */
  priceWords: string;
  /** Beside a price: "/bottle", "/case". */
  per: string;
  shop: Shop;
  /** Its alcohol-free name, for a no and low bar; null where it has none. */
  alcoholFree: string | null;
}

export const LINES: Record<BarLine, LineInfo> = {
  fizz: { name: "Fizz", unit: "bottle", units: "bottles", caseOf: 6, pricedPer: 1, priceWords: "a bottle", per: "/bottle", shop: "wine-merchant", alcoholFree: "Alcohol-free fizz" },
  white: { name: "White wine", unit: "bottle", units: "bottles", caseOf: 6, pricedPer: 1, priceWords: "a bottle", per: "/bottle", shop: "wine-merchant", alcoholFree: "Alcohol-free white wine" },
  red: { name: "Red wine", unit: "bottle", units: "bottles", caseOf: 6, pricedPer: 1, priceWords: "a bottle", per: "/bottle", shop: "wine-merchant", alcoholFree: "Alcohol-free red wine" },
  beer: { name: "Beer and cider", unit: "bottle or can", units: "bottles or cans", caseOf: 24, pricedPer: 24, priceWords: "a case of 24", per: "/case", shop: "cash-and-carry", alcoholFree: "Alcohol-free beer" },
  spirits: { name: "Spirits", unit: "70cl bottle", units: "70cl bottles", caseOf: 1, pricedPer: 1, priceWords: "a bottle", per: "/bottle", shop: "cash-and-carry", alcoholFree: "Alcohol-free spirits" },
  mixers: { name: "Mixers", unit: "litre", units: "litres", caseOf: 1, pricedPer: 1, priceWords: "a litre", per: "/litre", shop: "supermarket", alcoholFree: null },
  soft: { name: "Soft drinks", unit: "litre", units: "litres", caseOf: 1, pricedPer: 1, priceWords: "a litre", per: "/litre", shop: "supermarket", alcoholFree: null },
  ice: { name: "Ice", unit: "kilo", units: "kilos", caseOf: 1, pricedPer: 1, priceWords: "a kilo", per: "/kilo", shop: "supermarket", alcoholFree: null },
};

export const SHOP_NAMES: Record<Shop, string> = {
  "wine-merchant": "Wine merchant",
  "cash-and-carry": "Cash and carry",
  supermarket: "Supermarket",
};

export const BOTTLE_ML = 750;
export const SPIRIT_BOTTLE_ML = 700;
