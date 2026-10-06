import type { Knotwork } from "@jfrusher/knotwork";
import { barSum } from "@/lib/bar/sum";
import { SHOP_NAMES } from "@/lib/bar/defaults";
import { readCrew } from "@/lib/model/slices";
import { hiddenToolIds } from "@/lib/model/toolbox";
import type { Crew, Shop } from "@/lib/model/types";
import { daysBefore } from "./checklist";

export interface Errand {
  /** Stable while the errand is there: "bar:wine-merchant", "bar:ice". */
  id: string;
  label: string;
  /** ISO date, or "" while the wedding has no date. */
  dueOn: string;
  done: boolean;
}

/** How far before the day each shop is gone to: delivery and sale-or-return first, the ice last. */
const LEAD_DAYS: Record<Shop | "ice", number> = { "wine-merchant": 14, "cash-and-carry": 7, supermarket: 2, ice: 1 };

const listed = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * The shopping the Bar works out, as errands on the Checklist: one for each
 * shop with something to buy, and the ice on its own, the day before.
 * Worked out each time, never stored as tasks, so they follow the Bar and go
 * when it is hidden or has nothing to buy. Only the ticks are kept, by id.
 */
export function barErrands(doc: Knotwork): Errand[] {
  if (hiddenToolIds(doc).has("bar")) return [];
  const toBuy = barSum(doc).lines.filter((line) => line.buy > 0);
  const date = doc.event.date;
  const done = new Set(readCrew(doc).errandsDone);
  const errand = (key: Shop | "ice", label: string): Errand => ({
    id: `bar:${key}`,
    label,
    dueOn: date ? daysBefore(date, LEAD_DAYS[key]) : "",
    done: done.has(`bar:${key}`),
  });

  const out: Errand[] = [];
  for (const shop of ["wine-merchant", "cash-and-carry", "supermarket"] as const) {
    const names = toBuy.filter((line) => line.line !== "ice" && line.shop === shop).map((line) => line.name);
    if (names.length > 0) out.push(errand(shop, `Buy the ${listed(names)} from the ${SHOP_NAMES[shop].toLowerCase()}`));
  }
  if (toBuy.some((line) => line.line === "ice")) out.push(errand("ice", "Collect the ice"));
  return out;
}

/** The crew with one errand ticked or not; ticks for errands no longer there are dropped. */
export function withErrandDone(crew: Crew, id: string, done: boolean, present: Errand[]): Crew {
  const here = new Set(present.map((errand) => errand.id));
  const kept = crew.errandsDone.filter((tick) => tick !== id && here.has(tick));
  return { ...crew, errandsDone: done && here.has(id) ? [...kept, id] : kept };
}
