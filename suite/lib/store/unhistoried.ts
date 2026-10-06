/**
 * Parts of the document history does not own: carried from the document as it
 * is now into the one undo or redo restores. What was printed is the case in
 * point — undoing a colour change does not unprint the cards.
 *
 * A module of its own, importing nothing: tools register from modules the
 * store itself reaches while it is still loading.
 */
type Unhistoried = (now: Record<string, unknown>, restored: Record<string, unknown>) => Record<string, unknown>;

const carries: Unhistoried[] = [];

/** Registers a part of the document that undo and redo leave as it is now. */
export function keepThroughHistory(carry: Unhistoried): void {
  carries.push(carry);
}

/** `restored`, with every registered part as it is in `now`. */
export function carried(now: Record<string, unknown>, restored: Record<string, unknown>): Record<string, unknown> {
  return carries.reduce((raw, carry) => carry(now, raw), restored);
}
