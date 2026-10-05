import { fingerprint } from "@/lib/documents/fingerprint";
import type { Artefact } from "../core/data/artefacts";
import { normalise } from "../core/data/artefacts";
import { columnsUsed } from "../core/template/rebind";
import type { RoomScene, Template } from "../core/types";

/**
 * What a piece last went to the printer as: when, and each card's data, so a
 * change to the room afterwards can say which cards it made wrong.
 *
 * Only what the design reads is fingerprinted: the columns it binds, and the
 * part of the room a plan on it draws. A guest moving tables changes the cards
 * that print the table; it does not change a card that prints only a name —
 * even though every table's number shifts when one is renamed.
 */
export interface Printed {
  /** ISO time of the export. */
  at: string;
  /** Artefact key to its data's fingerprint. */
  cards: Record<string, string>;
}

/** What one artefact's paper depends on, for a design: the reader of its fingerprint. */
export type PrintBasis = (artefact: Artefact) => string;

export function printBasis(template: Template, room: RoomScene): PrintBasis {
  const columns = columnsUsed(template);
  const plans = template.elements.flatMap((el) => (el.kind === "room" ? [el.show] : []));
  return (artefact) => {
    const drawn = plans.map((show) =>
      show === "room"
        ? room
        : room.tables.filter((table) => normalise(table.label) === normalise(artefact.row["Table"] ?? "")),
    );
    return fingerprint([artefact.rows.map((row) => columns.map((column) => row[column] ?? "")), drawn]);
  };
}

/**
 * A record of these artefacts going to print now. A reprint of some adds to
 * what was printed before; a full run replaces it.
 */
export function recordPrint(
  previous: Printed | null,
  artefacts: Artefact[],
  partial: boolean,
  at: string,
  basis: PrintBasis,
): Printed {
  const cards = Object.fromEntries(artefacts.map((artefact) => [artefact.key, basis(artefact)]));
  return { at, cards: partial && previous ? { ...previous.cards, ...cards } : cards };
}

/**
 * Since the last print: the cards that would come out differently now — a
 * guest moved, renamed, or new — and the keys of cards printed then that
 * nothing prints now.
 */
export function sincePrinted(
  printed: Printed,
  artefacts: Artefact[],
  basis: PrintBasis,
): { changed: Artefact[]; gone: string[] } {
  const now = new Set(artefacts.map((artefact) => artefact.key));
  return {
    changed: artefacts.filter((artefact) => printed.cards[artefact.key] !== basis(artefact)),
    gone: Object.keys(printed.cards).filter((key) => !now.has(key)),
  };
}
