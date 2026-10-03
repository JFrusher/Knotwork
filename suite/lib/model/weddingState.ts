import { migrate } from "@jfrusher/knotwork";
import { money } from "@/lib/money/money";
import { readiness } from "./readiness";
import { readCrew } from "./slices";

/**
 * How one wedding stands, in a line, for a planner looking down the list of
 * their clients: how much is left and the one thing next — the front page's
 * own `readiness`, run over the stored document — and what is still to pay.
 */
export interface WeddingState {
  /** Everything What is left lists. */
  left: number;
  /** Of those, the problems rather than the nudges. */
  blocking: number;
  /** The front page's next step, or null when nothing is left. */
  next: string | null;
  /** Still to pay the suppliers. */
  owed: number;
}

export function weddingState(document: unknown, today: string): WeddingState {
  const raw = (document ?? {}) as Record<string, unknown>;
  const doc = migrate(raw);
  const items = readiness(doc, raw, today);
  const first = items.find((item) => item.severity === "blocking") ?? items[0];
  return {
    left: items.length,
    blocking: items.filter((item) => item.severity === "blocking").length,
    next: first?.message ?? null,
    owed: money(readCrew(doc)).owed,
  };
}
