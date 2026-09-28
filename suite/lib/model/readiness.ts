import type { Trousseau } from "@jfrusher/trousseau";
import { guestName, isComing, readCrew, readGuests, readSeating, readShots, readTimeline } from "./slices";
import { resolveShot } from "@/lib/ensemble/resolve";
import { daysUntil, DUE_SOON_DAYS, longDate, money, todayIso } from "@/lib/money/money";

/**
 * What is left to do, across the whole wedding.
 *
 * Deliberately only the things no single tool can work out. Each of the five
 * already checks its own work and is better at it than this could be: Tableaux
 * knows a table is over capacity, Cadence knows two blocks collide, Brigade
 * knows a job has nobody on it and that nobody is in two places at once. None
 * of that is repeated here — a warning shown twice in two wordings is worse
 * than one shown once, because you fix it in one place and it stays on screen
 * in the other.
 *
 * What is left is the gaps *between* the tools, which is exactly what nothing
 * could see while these were separate applications: place cards printed
 * from a list that no longer matches the room, a dietary requirement recorded
 * for someone whose card has nowhere to show it, a ceremony happening somewhere
 * that is not anywhere on the floor plan.
 */

export type Severity = "blocking" | "advisory";

export interface Readiness {
  id: string;
  severity: Severity;
  message: string;
  /** Where the fix is, so a row can take you there. */
  href: "/guests" | "/money" | "/seating" | "/place-cards" | "/timeline" | "/delegation" | "/group-shots";
  action: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The names the room has for its parts, which the day's locations should match. */
function placeNames(raw: unknown): Set<string> {
  const seating = isRecord(raw) ? raw["seating"] : null;
  const room = isRecord(seating) ? seating["room"] : null;
  const spaces = isRecord(room) ? room["spaces"] : null;
  const names = new Set<string>();
  if (!Array.isArray(spaces)) return names;
  for (const space of spaces) {
    if (isRecord(space) && typeof space["label"] === "string") {
      names.add(space["label"].trim().toLowerCase());
    }
  }
  return names;
}

/** Plaque's saved design, which knows what the printed list was drawn from. */
export function stationery(raw: unknown): Record<string, unknown> | null {
  const slice = isRecord(raw) ? raw["stationery"] : null;
  return isRecord(slice) && "version" in slice ? slice : null;
}

/**
 * Every column the card design binds, so we can tell what it can and cannot
 * show: the tokens in its text, and the column an icon is drawn from — the
 * same two Plaque's own `unboundTokens` counts.
 */
function boundTokens(design: Record<string, unknown> | null): Set<string> {
  const tokens = new Set<string>();
  const template = design && isRecord(design["template"]) ? design["template"] : null;
  const elements = template && Array.isArray(template["elements"]) ? template["elements"] : [];
  for (const element of elements) {
    if (!isRecord(element)) continue;
    if (element["kind"] === "icon" && typeof element["sourceField"] === "string") {
      tokens.add(element["sourceField"].trim().toLowerCase());
    }
    for (const value of Object.values(element)) {
      if (typeof value !== "string") continue;
      for (const match of value.matchAll(/\{\{([^}]+)\}\}/g)) {
        tokens.add((match[1] ?? "").trim().toLowerCase());
      }
    }
  }
  return tokens;
}

/**
 * @param doc    the parsed wedding, for the typed readers
 * @param raw    the slices as stored, for the parts the readers narrow away
 * @param today  ISO date, for what falls due; the user's own today unless a test says otherwise
 */
export function readiness(doc: Trousseau, raw: unknown, today: string = todayIso()): Readiness[] {
  const out: Readiness[] = [];
  const guests = readGuests(doc);
  const people = Object.values(guests);
  const seating = readSeating(doc);
  const timeline = readTimeline(doc);
  const crew = readCrew(doc);
  const design = stationery(raw);

  if (people.length === 0) {
    return [
      {
        id: "no-guests",
        severity: "advisory",
        message: "No guest list yet. Everything else is built on it.",
        href: "/guests",
        action: "Import a guest list",
      },
    ];
  }

  // Somebody who is not coming has no seat to find, and no card to print.
  const coming = people.filter(isComing);
  const unseated = coming.filter((guest) => guest.assignedTableId === null);
  if (unseated.length > 0 && Object.keys(seating.tables).length > 0) {
    out.push({
      id: "unseated",
      severity: "advisory",
      message:
        unseated.length === 1
          ? `${guestName(unseated[0]!) || "One guest"} has no table yet.`
          : `${unseated.length} guests have no table yet.`,
      href: "/seating",
      action: "Seat them",
    });
  }

  /**
   * The cards were printed from a file rather than from the room.
   *
   * This is the failure the suite exists to prevent, and the one that costs
   * real money: a CSV exported before the last three people moved prints three
   * wrong tables and looks perfectly correct doing it.
   */
  if (design && design["fileName"] !== "the room" && Array.isArray(design["rows"])) {
    out.push({
      id: "cards-from-file",
      severity: "blocking",
      message:
        "The place cards come from an imported file, not from the room, so they can disagree with the seating plan.",
      href: "/place-cards",
      action: "Use the room",
    });
  }

  const withDietary = coming.filter((guest) => guest.dietary.trim() !== "");
  if (design && withDietary.length > 0 && !boundTokens(design).has("dietary")) {
    out.push({
      id: "dietary-unprinted",
      severity: "advisory",
      message:
        withDietary.length === 1
          ? "One guest has a dietary requirement, and the card design has nowhere to show it."
          : `${withDietary.length} guests have dietary requirements, and the card design has nowhere to show them.`,
      href: "/place-cards",
      action: "Add it to the card",
    });
  }

  const unplaced = timeline.blocks.filter((block) => block.location.trim() === "");
  if (unplaced.length > 0) {
    out.push({
      id: "blocks-unplaced",
      severity: "advisory",
      message:
        unplaced.length === 1
          ? `“${unplaced[0]!.label}” does not say where it happens.`
          : `${unplaced.length} parts of the day do not say where they happen.`,
      href: "/timeline",
      action: "Say where",
    });
  }

  /**
   * A location that is not anywhere in the room.
   *
   * Only worth saying when the room's names are demonstrably in use — at least
   * one block already matches one. If none of them do, the day is simply
   * described in its own words, which is a choice rather than a mistake: the
   * ceremony can be at a church nobody is going to draw a floor plan of. The
   * first version of this fired on every block of a day that had never heard of
   * the room, which is noise on exactly the plan it is least use to.
   */
  const places = placeNames(raw);
  const located = timeline.blocks.filter((block) => block.location.trim() !== "");
  const matching = located.filter((block) => places.has(block.location.trim().toLowerCase()));

  if (places.size > 0 && matching.length > 0) {
    const elsewhere = located.filter(
      (block) => !places.has(block.location.trim().toLowerCase()),
    );
    if (elsewhere.length > 0) {
      out.push({
        id: "blocks-off-plan",
        severity: "advisory",
        message:
          elsewhere.length === 1
            ? `“${elsewhere[0]!.label}” happens in ${elsewhere[0]!.location}, which is not part of the room you have drawn.`
            : `${elsewhere.length} parts of the day happen somewhere that is not part of the room you have drawn.`,
        href: "/timeline",
        action: "Check the location",
      });
    }
  }

  const uncrewed = crew.jobs.filter((job) => job.personIds.length === 0);
  if (uncrewed.length > 0) {
    out.push({
      id: "jobs-uncrewed",
      severity: "blocking",
      message:
        uncrewed.length === 1
          ? `“${uncrewed[0]!.label}” has nobody doing it.`
          : `${uncrewed.length} jobs have nobody doing them.`,
      href: "/delegation",
      action: "Put names on them",
    });
  }

  /**
   * A shot pointing at someone or something that has since been deleted.
   * Only the "dangling" kind — a declined guest or an empty shot is already
   * visible inline in the tool itself, and repeating it here is exactly the
   * double-reporting this module exists to avoid.
   */
  const shots = readShots(doc);
  const dangling = shots.sections
    .flatMap((section) => section.shots)
    .flatMap((shot) => resolveShot(shot, guests, seating, shots.cast, shots.customRoles, doc.event).problems)
    .filter((problem) => problem.kind === "dangling").length;

  if (dangling > 0) {
    out.push({
      id: "shots-dangling",
      severity: "blocking",
      message:
        dangling === 1
          ? "One group shot points at someone or something that no longer exists."
          : `${dangling} group shots point at someone or something that no longer exists.`,
      href: "/group-shots",
      action: "Fix the shot list",
    });
  }

  const accounts = money(crew);
  if (accounts.budget !== null && accounts.left !== null && accounts.left < 0) {
    out.push({
      id: "over-budget",
      severity: "advisory",
      message: `Committed ${accounts.committed.toLocaleString()} against a budget of ${accounts.budget.toLocaleString()}.`,
      href: "/money",
      action: "Look at the costs",
    });
  }

  // Balances, which have a date; a deposit is paid when the supplier is booked.
  const balances = accounts.toPay.filter((payment) => payment.kind === "balance" && payment.dueOn !== "");
  const overdue = balances.filter((payment) => daysUntil(payment.dueOn, today) < 0);
  const soon = balances.filter((payment) => {
    const days = daysUntil(payment.dueOn, today);
    return days >= 0 && days <= DUE_SOON_DAYS;
  });
  const one = (payment: (typeof balances)[number], tense: "was" | "is") =>
    `${payment.team}’s balance of ${payment.amount.toLocaleString()} ${tense} due on ${longDate(payment.dueOn)}.`;
  if (overdue.length > 0) {
    out.push({
      id: "payments-overdue",
      severity: "blocking",
      message: overdue.length === 1 ? one(overdue[0]!, "was") : `${overdue.length} balances are overdue.`,
      href: "/money",
      action: "Pay, or mark them paid",
    });
  }
  if (soon.length > 0) {
    out.push({
      id: "payments-due",
      severity: "advisory",
      message: soon.length === 1 ? one(soon[0]!, "is") : `${soon.length} balances fall due in the next ${DUE_SOON_DAYS} days.`,
      href: "/money",
      action: "See what is due",
    });
  }

  // Only teams with something to do on the day. A venue you are merely paying
  // has nothing to confirm.
  const working = new Set(
    crew.jobs.map((job) => job.teamId).filter((id): id is string => id !== null),
  );
  const unconfirmed = crew.teams.filter(
    (team) => working.has(team.id) && team.confirmedOn === "",
  );
  if (unconfirmed.length > 0) {
    out.push({
      id: "unconfirmed-teams",
      severity: "advisory",
      message:
        unconfirmed.length === 1
          ? `${unconfirmed[0]!.name} has not confirmed yet.`
          : `${unconfirmed.length} suppliers have not confirmed yet.`,
      href: "/delegation",
      action: "Chase them",
    });
  }

  return out;
}
