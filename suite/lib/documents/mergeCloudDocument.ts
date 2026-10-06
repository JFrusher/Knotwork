import { SLICE_NAMES, type SliceName } from "@jfrusher/knotwork";
import { fingerprint } from "./fingerprint";
import { assemble, DERIVED, partInfo, partsOf } from "./parts";

/**
 * Three-way merge over a whole-document compare-and-set store, part by part.
 *
 * The server holds one document with one version (lib/documents), but two
 * partners editing different things in the same window should not have to
 * choose between their edits. Each side is cut into parts — a guest, a table,
 * a block, a job, or a slice that is edited as a whole (lib/documents/parts)
 * — and each part is compared with what the two sides last agreed: taken from
 * the server if only it changed, kept if only this side did, and a conflict
 * only if both changed the same part differently. Two people seating two
 * different guests merge; two people renaming the same table do not.
 */

/** What the two sides last agreed, part by part: part key → fingerprint. */
export type Agreed = Record<string, string>;

export interface PartConflict {
  /** Which part — see `lib/documents/parts`. */
  key: string;
  slice: SliceName;
  /** This side's value, or undefined where this side removed it. */
  mine: unknown;
  /** The server's value, ready to apply if the user takes it; undefined where it was removed. */
  theirs: unknown;
}

interface MergeResult {
  /** Ready to become the new local raw document. */
  raw: Record<string, unknown>;
  /** Parts changed on both sides. This side's value stands in `raw` until the user chooses. */
  conflicts: PartConflict[];
  /** Updated agreement: every part that is now settled. */
  agreed: Agreed;
  /**
   * True when anything in `raw` came from the server rather than from here.
   *
   * A caller that replaces the document unconditionally makes every accepted
   * server write bounce straight back — a version bump and a history row for a
   * document nobody changed, which the *other* tab then pulls and bounces
   * again. It also remounts the whole tool subtree on both devices every
   * poll. So: replace and push only when this is true.
   */
  adopted: boolean;
}

/** Stands for a part one side does not have, so absence can be compared like a value. */
const ABSENT = "absent";

const fp = (parts: ReadonlyMap<string, unknown>, key: string) => (parts.has(key) ? fingerprint(parts.get(key)) : ABSENT);

export function fingerprintParts(raw: Record<string, unknown>): Agreed {
  const agreed: Agreed = {};
  for (const [key, value] of partsOf(raw)) agreed[key] = fingerprint(value);
  return agreed;
}

/**
 * `order`, with every id of `other` that is present and missing from it put in
 * after the id it follows in `other` — so a block added on the other side
 * lands where it was added, not at the end of the day.
 */
function weave(order: readonly string[], other: readonly string[], present: ReadonlySet<string>): string[] {
  const result = order.filter((id) => present.has(id));
  other.forEach((id, index) => {
    if (!present.has(id) || result.includes(id)) return;
    const before = other.slice(0, index).reverse().find((earlier) => result.includes(earlier));
    result.splice(before === undefined ? 0 : result.indexOf(before) + 1, 0, id);
  });
  return result;
}

/** One fingerprint for everything the published day is made from. */
function dayInputs(parts: ReadonlyMap<string, unknown>): string {
  const inputs = [...parts.entries()]
    .filter(([key]) => {
      const { slice } = partInfo(key);
      return slice === "timeline" || slice === "event";
    })
    .map(([key, value]) => `${key}=${fingerprint(value)}`)
    .sort();
  return fingerprint(inputs);
}

/**
 * @param publishDay  the day as published from a document's timeline and event;
 *                    used only when the merged timeline is neither side's own
 */
export function mergeCloudDocument(
  localRaw: Record<string, unknown>,
  serverRaw: Record<string, unknown>,
  agreedBefore: Agreed,
  publishDay: (raw: Record<string, unknown>) => unknown,
): MergeResult {
  const mine = partsOf(localRaw);
  const theirs = partsOf(serverRaw);
  const merged = new Map<string, unknown>();
  const agreed: Agreed = { ...agreedBefore };
  const conflicts: PartConflict[] = [];
  const orders: string[] = [];
  // A top-level key this build has never heard of — a slice a newer version
  // of the suite added — is the server's, and taking it is adopting it.
  let adopted = Object.keys(serverRaw).some(
    (key) => !(key in localRaw) && !(SLICE_NAMES as readonly string[]).includes(key),
  );

  // This side's order first, so an unchanged document assembles as it was.
  const keys = [...mine.keys(), ...[...theirs.keys()].filter((key) => !mine.has(key))];
  for (const key of keys) {
    if (partInfo(key).order) {
      orders.push(key);
      continue;
    }
    const mineFp = fp(mine, key);
    const theirFp = fp(theirs, key);
    if (mineFp === theirFp) {
      if (mine.has(key)) merged.set(key, mine.get(key));
      agreed[key] = mineFp;
      continue;
    }
    // A part missing from the agreement was not there when the two last agreed.
    const base = agreedBefore[key] ?? ABSENT;
    const changedHere = mineFp !== base;
    const changedThere = theirFp !== base;
    if (changedHere && changedThere) {
      conflicts.push({ key, slice: partInfo(key).slice, mine: mine.get(key), theirs: theirs.get(key) });
      if (mine.has(key)) merged.set(key, mine.get(key));
      continue;
    }
    if (changedThere) {
      if (theirs.has(key)) merged.set(key, theirs.get(key));
      agreed[key] = theirFp;
      adopted = true;
      continue;
    }
    // Changed here only: kept, and agreed once a push is accepted.
    if (mine.has(key)) merged.set(key, mine.get(key));
  }

  // A list's order is never a conflict. Only the server moved it: theirs.
  // Otherwise this side's, with the records only the server has woven in.
  for (const key of orders) {
    const mineOrder = (mine.get(key) as string[] | undefined) ?? [];
    const theirOrder = (theirs.get(key) as string[] | undefined) ?? [];
    const prefix = key.slice(0, -"#order".length);
    const present = new Set(
      [...merged.keys()].filter((part) => part.startsWith(`${prefix}/`)).map((part) => part.slice(prefix.length + 1)),
    );
    const onlyThere = fp(mine, key) === (agreedBefore[key] ?? ABSENT) && fp(theirs, key) !== fp(mine, key);
    const order = onlyThere ? weave(theirOrder, mineOrder, present) : weave(mineOrder, theirOrder, present);
    merged.set(key, order);
    if (fingerprint(order) === fp(theirs, key)) {
      agreed[key] = fp(theirs, key);
      if (fp(theirs, key) !== fp(mine, key)) adopted = true;
    }
  }

  // Seeded from the server and overlaid with this side, so a key only the
  // server has survives; every slice with parts is then set from them.
  const raw = assemble(merged, { ...serverRaw, ...localRaw });

  // The published day follows whichever timeline and event it is: this
  // side's, the server's, or — when they were merged from both — worked out
  // again from the merged ones.
  const inputs = dayInputs(merged);
  if (inputs === dayInputs(mine)) raw[DERIVED] = localRaw[DERIVED];
  else if (inputs === dayInputs(theirs)) raw[DERIVED] = serverRaw[DERIVED];
  else raw[DERIVED] = publishDay(raw);
  if (raw[DERIVED] === undefined) delete raw[DERIVED];

  return { raw, conflicts, agreed, adopted };
}
