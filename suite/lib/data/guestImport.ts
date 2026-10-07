import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import type { Guest, RsvpStatus, Side } from "@/lib/model/types";
import { newGuest } from "@/lib/model/factories";
import { normaliseDietary } from "@/lib/model/dietary";
import { dropGuests } from "@/lib/guests/edit";
import type { CsvTable } from "./csv";

/**
 * Turning an uploaded guest list into guests.
 *
 * The mapping is guessed, never enforced: a column the guesser misses is still
 * bindable by hand, and a list with none of these headers still imports — as
 * names and nothing else. Refusing an unfamiliar export would send the user
 * back to a spreadsheet, which is the thing this replaces.
 *
 * Patterns are Stationery's `guessMapping` and Tableaux's `csvParser` merged, since
 * between them they already covered the exports these lists arrive as.
 *
 * The one importer. Seating had a second, with different rules — it replaced
 * the list on request, matched by email, and stored diets as keys where this
 * one stored the file's words — and a guest list imported one way looked
 * different to the tools than one imported the other. This keeps the better
 * rule from each, and nothing it produces is written until the couple has seen
 * the preview.
 */

export interface FieldMapping {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  rsvp: string | null;
  dietary: string | null;
  entree: string | null;
  side: string | null;
  notes: string | null;
}

export const MAPPABLE_FIELDS: Array<{ key: keyof FieldMapping; label: string }> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "fullName", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "rsvp", label: "RSVP" },
  { key: "dietary", label: "Dietary" },
  { key: "entree", label: "Main course" },
  { key: "side", label: "Side" },
  { key: "notes", label: "Notes" },
];

/** Checked in order; the first header matching a pattern wins that field. */
const PATTERNS: Array<[keyof FieldMapping, RegExp]> = [
  // The optional "guest" prefix covers RSVP exports that label every column
  // with whose it is: "Guest First", "Guest Surname".
  ["firstName", /^(guest)?(first|firstname|forename|givenname|given|fname)$/],
  ["lastName", /^(guest)?(last|lastname|surname|familyname|family|lname)$/],
  ["fullName", /^(name|fullname|guest|guestname|displayname)$/],
  ["email", /^(email|e-?mail|mail|emailaddress)$/],
  ["rsvp", /^(rsvp|attending|attend|coming|response|status|rsvpstatus)$/],
  [
    "dietary",
    /^(dietary|diet|dietaryneeds|dietaryrequirements?|dietaryrestrictions?|requirements|allergies|allergy|allergens|restrictions)$/,
  ],
  ["entree", /^(entree|entrée|main|maincourse|mealchoice|course|food)$/],
  // Not "party": Joy's Party column is the household invited together, and
  // reading it as a side filed every guest under nobody's.
  ["side", /^(side|guestof|relation)$/],
  ["notes", /^(notes?|comment|comments|remark|remarks)$/],
];

const normalise = (header: string): string => header.toLowerCase().replace(/[^a-z0-9é]/g, "");

export function guessMapping(headers: string[]): FieldMapping {
  const guesses: FieldMapping = {
    firstName: null,
    lastName: null,
    fullName: null,
    email: null,
    rsvp: null,
    dietary: null,
    entree: null,
    side: null,
    notes: null,
  };

  for (const header of headers) {
    const key = normalise(header);
    for (const [field, pattern] of PATTERNS) {
      if (guesses[field] === null && pattern.test(key)) {
        guesses[field] = header;
        break;
      }
    }
  }

  return guesses;
}

/** A list this long is a mistake, not a wedding. */
export const MAX_ROWS = 5000;

const COMING = new Set([
  "yes", "y", "confirmed", "confirm", "true", "1", "attending", "coming", "accepted", "going",
]);
const NOT_COMING = new Set([
  "no", "n", "declined", "decline", "false", "0", "regrets", "regret", "not attending", "not coming",
  "cannot", "can't",
]);

/** Every distinct answer in the RSVP column, for the couple to say what each means. */
export function rsvpAnswers(table: CsvTable, mapping: FieldMapping): string[] {
  if (!mapping.rsvp) return [];
  const answers = new Set<string>();
  for (const row of table.rows) {
    const value = (row[mapping.rsvp] ?? "").trim();
    if (value) answers.add(value);
  }
  return [...answers].sort((a, b) => a.localeCompare(b));
}

/**
 * A first guess at what each answer means. Only a guess: exports word this
 * every way there is, and the preview lets the couple correct any of it.
 */
export function guessRsvpMeaning(answers: string[]): Record<string, RsvpStatus> {
  const meaning: Record<string, RsvpStatus> = {};
  for (const answer of answers) {
    const key = answer.trim().toLowerCase();
    meaning[answer] = COMING.has(key) ? "confirmed" : NOT_COMING.has(key) ? "declined" : "pending";
  }
  return meaning;
}

/** Every distinct answer in the Side column, for the couple to say whose each is. */
export function sideAnswers(table: CsvTable, mapping: FieldMapping): string[] {
  if (!mapping.side) return [];
  const answers = new Set<string>();
  for (const row of table.rows) {
    const value = (row[mapping.side] ?? "").trim();
    if (value) answers.add(value);
  }
  return [...answers].sort((a, b) => a.localeCompare(b));
}

/**
 * A first guess at whose side each answer means: a partner's name, or "both".
 * "Bride" and "Groom" are left for the couple — the words do not say which of
 * the two of them they are, and guessing would put a family on the wrong side.
 */
export function guessSideMeaning(
  answers: string[],
  event: Pick<WeddingEvent, "partners">,
): Record<string, Side> {
  const [a, b] = (event.partners ?? ["", ""]).map((name) => name.trim().toLowerCase());
  const meaning: Record<string, Side> = {};
  for (const answer of answers) {
    const key = answer.trim().toLowerCase();
    meaning[answer] =
      a && key.startsWith(a) ? "a" : b && key.startsWith(b) ? "b" : /^(both|shared)/.test(key) ? "both" : "";
  }
  return meaning;
}

/** What the couple has said the file's answers mean. */
interface Meanings {
  rsvp: Record<string, RsvpStatus>;
  side: Record<string, Side>;
}

/** A whole name in one column: everything before the last space is the first name. */
function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: full.trim(), lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1]! };
}

interface ImportPlan {
  /** The whole guest list once imported — before anything in `missing` is removed. */
  guests: Record<string, Guest>;
  added: Guest[];
  updated: Guest[];
  unchanged: number;
  /** Already on the list, and not in this file. Kept unless the couple says otherwise. */
  missing: Guest[];
  /**
   * Rows whose name is shared by more than one guest already on the list, with
   * no email to say which. Not in `guests`: guessing would edit the wrong Sarah
   * Smith, and adding them blindly would add every Sarah Smith again on every
   * re-import. The preview lists them for the couple to add by hand.
   */
  ambiguous: Guest[];
  /** Rows with no name at all. */
  skipped: number;
}

/** The fields an import may change on someone already on the list. */
const UPDATABLE = ["email", "rsvpStatus", "dietary", "dietaryRaw", "entree", "notes", "side"] as const;

/**
 * What importing this file would do, without doing it.
 *
 * Each row is a person. One already on the list is found by email first, then
 * by a name no other guest shares — and never when both have an email and the
 * emails differ, because then they are two people. Found, they keep their name,
 * their seat, their groups and anything the file leaves blank; the file fills
 * in the rest. Nobody is unseated and nobody is removed here: the couple
 * chooses from `missing` in the preview.
 */
export function planImport(
  table: CsvTable,
  mapping: FieldMapping,
  meanings: Meanings,
  existing: Record<string, Guest>,
): ImportPlan {
  const byEmail = new Map<string, Guest>();
  const byName = new Map<string, Guest[]>();
  for (const guest of Object.values(existing)) {
    if (guest.email) byEmail.set(guest.email.trim().toLowerCase(), guest);
    const key = nameKey(guest.firstName, guest.lastName);
    byName.set(key, [...(byName.get(key) ?? []), guest]);
  }

  const guests: Record<string, Guest> = { ...existing };
  const used = new Set<string>();
  const added: Guest[] = [];
  const updated: Guest[] = [];
  const ambiguous: Guest[] = [];
  let unchanged = 0;
  let skipped = 0;

  const cell = (row: Record<string, string>, header: string | null): string =>
    header === null ? "" : (row[header] ?? "").trim();

  for (const row of table.rows) {
    let firstName = cell(row, mapping.firstName);
    let lastName = cell(row, mapping.lastName);
    if (!firstName && !lastName) ({ firstName, lastName } = splitFullName(cell(row, mapping.fullName)));
    if (!firstName && !lastName) {
      skipped++;
      continue;
    }

    const email = cell(row, mapping.email);
    const answer = cell(row, mapping.rsvp);
    const diet = cell(row, mapping.dietary);
    const side = cell(row, mapping.side);

    const byMail = email ? byEmail.get(email.toLowerCase()) : undefined;
    const sameName = (byName.get(nameKey(firstName, lastName)) ?? []).filter(
      (guest) =>
        !used.has(guest.id) &&
        !(email && guest.email && guest.email.toLowerCase() !== email.toLowerCase()),
    );
    const match = byMail && !used.has(byMail.id) ? byMail : sameName.length === 1 ? sameName[0] : undefined;

    if (match) {
      used.add(match.id);
      const next: Guest = {
        ...match,
        email: email || match.email,
        rsvpStatus: answer ? (meanings.rsvp[answer] ?? "pending") : match.rsvpStatus,
        dietary: diet ? normaliseDietary(diet) : match.dietary,
        dietaryRaw: diet || match.dietaryRaw,
        entree: cell(row, mapping.entree) || match.entree,
        notes: cell(row, mapping.notes) || match.notes,
        side: side ? (meanings.side[side] ?? "") : match.side,
      };
      guests[match.id] = next;
      if (UPDATABLE.some((field) => next[field] !== match[field])) updated.push(next);
      else unchanged++;
      continue;
    }

    const guest = newGuest({
      firstName,
      lastName,
      email,
      rsvpStatus: answer ? (meanings.rsvp[answer] ?? "pending") : "pending",
      dietary: normaliseDietary(diet),
      dietaryRaw: diet,
      entree: cell(row, mapping.entree),
      notes: cell(row, mapping.notes),
      side: side ? (meanings.side[side] ?? "") : "",
    });
    if (sameName.length > 1) {
      ambiguous.push(guest);
      continue;
    }
    guests[guest.id] = guest;
    added.push(guest);
  }

  const missing = Object.values(existing).filter((guest) => !used.has(guest.id));
  return { guests, added, updated, unchanged, missing, ambiguous, skipped };
}

function nameKey(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The import as it is written: the planned list, plus whichever held-back rows
 * the couple chose to add, minus whoever they chose to remove — who also leave
 * every table, group, family and seating rule they were in. `seating` is null
 * when nobody was removed, so an import that only adds and updates writes the
 * guest list and nothing else.
 */
export function applyImport(
  plan: ImportPlan,
  choices: { add: ReadonlySet<string>; remove: ReadonlySet<string> },
  seating: unknown,
): { guests: Record<string, unknown>; seating: Record<string, unknown> | null } {
  const guests: Record<string, unknown> = { ...plan.guests };
  for (const guest of plan.ambiguous) if (choices.add.has(guest.id)) guests[guest.id] = guest;
  if (choices.remove.size === 0) return { guests, seating: null };
  const stored = typeof seating === "object" && seating !== null && !Array.isArray(seating) ? (seating as Record<string, unknown>) : {};
  return dropGuests({ guests, seating: stored }, [...choices.remove]);
}
