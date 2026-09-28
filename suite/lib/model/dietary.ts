/**
 * What a dietary requirement is, for every tool.
 *
 * Two fields on a guest, with one job each:
 *
 * - `dietary` is a key from the small set below — `vegetarian`, `gluten-free`,
 *   `other` — or empty. Filters, badges and counts read it, so "V", "veggie"
 *   and "Vegetarian" are one diet rather than three.
 * - `dietaryRaw` is what the guest actually said: "Coeliac — severe",
 *   "no shellfish please". The caterer and the place card need that, not the
 *   key.
 *
 * This was Seating's own model. The Data panel's importer wrote the file's
 * words straight into `dietary` instead, so Seating's Vegetarian filter found
 * none of the thirteen vegetarians in the example wedding, and its breakdown
 * listed "None" as a diet. One importer now, and this is the one definition.
 */

export interface DietaryMeta {
  key: string;
  label: string;
  /** A letter or two for a badge. */
  abbrev: string;
  colour: string;
}

export const DIETARY_META = {
  vegetarian: { key: "vegetarian", label: "Vegetarian", abbrev: "V", colour: "#4A7C59" },
  vegan: { key: "vegan", label: "Vegan", abbrev: "VG", colour: "#3E7C46" },
  "gluten-free": { key: "gluten-free", label: "Gluten-free", abbrev: "GF", colour: "#C07C2A" },
  "nut-allergy": { key: "nut-allergy", label: "Nut allergy", abbrev: "N", colour: "#A63228" },
  "dairy-free": { key: "dairy-free", label: "Dairy-free", abbrev: "DF", colour: "#5C7E9E" },
  pescatarian: { key: "pescatarian", label: "Pescatarian", abbrev: "P", colour: "#5E8A7C" },
  halal: { key: "halal", label: "Halal", abbrev: "H", colour: "#7B6FA0" },
  kosher: { key: "kosher", label: "Kosher", abbrev: "K", colour: "#9A6BA0" },
  other: { key: "other", label: "Other", abbrev: "•", colour: "#A8A29E" },
} as const satisfies Record<string, DietaryMeta>;

export type DietaryKey = keyof typeof DIETARY_META;
export const DIETARY_KEYS = Object.keys(DIETARY_META) as DietaryKey[];

/** Answers that mean "no requirement", which is not a diet called "None". */
const NONE_VALUES = new Set(["", "none", "n/a", "na", "no", "nil", "-", "standard", "normal"]);

/** A free-text answer to its key, or "" for no requirement. */
export function normaliseDietary(raw: string | null | undefined): DietaryKey | "" {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase();
  if (NONE_VALUES.has(s)) return "";
  if (/\bvegan\b|\bvg\b|\bvgn\b/.test(s)) return "vegan";
  if (/vegetarian|veggie|\bveg\b|\bv\b/.test(s)) return "vegetarian";
  if (/gluten|coeliac|celiac|\bgf\b/.test(s)) return "gluten-free";
  if (/\bnut|peanut/.test(s)) return "nut-allergy";
  if (/dairy|lactose|\bdf\b/.test(s)) return "dairy-free";
  // Match the actual word — "shellfish" allergy must not read as pescatarian.
  if (/pescat|pescet/.test(s)) return "pescatarian";
  if (/halal/.test(s)) return "halal";
  if (/kosher/.test(s)) return "kosher";
  return "other";
}

export function isDietaryKey(value: string): value is DietaryKey {
  return Object.hasOwn(DIETARY_META, value);
}

export const dietaryMeta = (key: string): DietaryMeta | null =>
  isDietaryKey(key) ? DIETARY_META[key] : null;

export const dietaryLabel = (key: string): string => dietaryMeta(key)?.label ?? key;

/**
 * What to print or show for a guest's requirement: their own words when there
 * are any, the diet's name when there are not, and nothing for no requirement.
 */
export function dietaryText(guest: { dietary: string; dietaryRaw?: string }): string {
  if (!guest.dietary) return "";
  const said = guest.dietaryRaw?.trim() ?? "";
  return said || dietaryLabel(guest.dietary);
}
