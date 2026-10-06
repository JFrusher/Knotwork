import type { Knotwork } from "@jfrusher/knotwork";
import { dayPlaces, guestName, isComing, readBoxes, readCast, readCeremony, readCrew, readGuests, readSeating, readShots, readTimeline } from "./slices";
import { neededAt, packingOf } from "@/lib/boxes/view";
import { hiddenToolIds } from "./toolbox";
import { TOOLS } from "@/lib/tools";
import { resolveMembers } from "@/lib/cast/resolve";
import { ceremonyPlace, overrun } from "@/lib/ceremony/checks";
import { DUE_SOON_DAYS, money } from "@/lib/money/money";
import { daysUntil, longDate, todayIso } from "@/lib/dates";
import { checklist } from "@/lib/checklist/checklist";
import { storedPieces } from "@/apps/plaque/state/suite";

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

/** How close to the day unpacked boxes are worth saying so. */
const PACKING_DAYS = 7;

export interface Readiness {
  id: string;
  severity: Severity;
  message: string;
  /** Where the fix is, so a row can take you there. */
  href:
    | "/guests"
    | "/money"
    | "/checklist"
    | "/seating"
    | "/stationery"
    | "/timeline"
    | "/delegation"
    | "/group-shots"
    | "/ceremony"
    | "/boxes";
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

/** Stationery's saved pieces, each of which knows what its printed list was drawn from. Empty when nothing is designed. */
export function stationeryPieces(raw: unknown): Record<string, unknown>[] {
  return storedPieces(isRecord(raw) ? raw["stationery"] : null);
}

/**
 * Every column the card design binds, so we can tell what it can and cannot
 * show: the tokens in its text, and the column an icon is drawn from — the
 * same two Plaque's own `unboundTokens` counts.
 */
function boundTokens(pieces: Record<string, unknown>[]): Set<string> {
  const tokens = new Set<string>();
  const elements = pieces.flatMap((piece) => {
    const template = isRecord(piece["template"]) ? piece["template"] : null;
    return template && Array.isArray(template["elements"]) ? template["elements"] : [];
  });
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
export function readiness(doc: Knotwork, raw: unknown, today: string = todayIso()): Readiness[] {
  const out: Readiness[] = [];
  const guests = readGuests(doc);
  const people = Object.values(guests);
  const seating = readSeating(doc);
  const timeline = readTimeline(doc);
  const crew = readCrew(doc);
  const pieces = stationeryPieces(raw);

  // The first steps (a guest list, the room, the cards, the ceremony's place)
  // are for getting going; once the day has passed there is nothing to start.
  const over = doc.event.date !== "" && daysUntil(doc.event.date, today) < 0;

  if (people.length === 0) {
    if (over) return [];
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

  const withDietary = coming.filter((guest) => guest.dietary.trim() !== "");
  if (pieces.length > 0 && withDietary.length > 0 && !boundTokens(pieces).has("dietary")) {
    out.push({
      id: "dietary-unprinted",
      severity: "advisory",
      message:
        withDietary.length === 1
          ? "One guest has a dietary requirement, and the card design has nowhere to show it."
          : `${withDietary.length} guests have dietary requirements, and the card design has nowhere to show them.`,
      href: "/stationery",
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

  // On the day only. A task off it with nobody named is the couple's own to
  // do, and the Checklist is where it is kept track of.
  const uncrewed = crew.jobs.filter((job) => job.blockId !== null && job.personIds.length === 0);
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
  const cast = readCast(doc);
  const dangling = shots.sections
    .flatMap((section) => section.shots)
    .flatMap((shot) => resolveMembers(shot, guests, seating, cast.roles, cast.customRoles, doc.event).problems)
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

  // The same for the ceremony, read from the same cast: whoever walks, leads a
  // part, or signs as a witness.
  const ceremony = readCeremony(doc);
  const named = [
    ...ceremony.processional,
    ...ceremony.order.filter((moment) => moment.members.length > 0).map((moment) => ({ label: moment.title, members: moment.members })),
    ...(ceremony.witnesses.length > 0 ? [{ label: "The witnesses", members: ceremony.witnesses }] : []),
  ];
  const namingNobody = named
    .flatMap((group) => resolveMembers(group, guests, seating, cast.roles, cast.customRoles, doc.event).problems)
    .filter((problem) => problem.kind === "dangling").length;

  if (namingNobody > 0) {
    out.push({
      id: "ceremony-dangling",
      severity: "blocking",
      message:
        namingNobody === 1
          ? "The ceremony names someone who is not set, or no longer exists."
          : `The ceremony names ${namingNobody} people or roles who are not set, or no longer exist.`,
      href: "/ceremony",
      action: "Fix the ceremony",
    });
  }

  // Where and when the ceremony is are the Timeline's, which Ceremony cannot change.
  const { place: ceremonyAt, lost: ceremonyLost } = ceremonyPlace(ceremony, dayPlaces(doc));
  if (ceremonyLost) {
    out.push({
      id: "ceremony-lost",
      severity: "blocking",
      message: "The ceremony is planned for a part of the day that is no longer on the Timeline.",
      href: "/ceremony",
      action: "Say when it is",
    });
  }
  const runsOver = overrun(ceremony, ceremonyAt);
  if (runsOver > 0) {
    out.push({
      id: "ceremony-overruns",
      severity: "advisory",
      message: `The order of service runs ${runsOver} ${runsOver === 1 ? "minute" : "minutes"} longer than the ceremony on the Timeline.`,
      href: "/ceremony",
      action: "Shorten it, or lengthen the block",
    });
  }

  // A box needed for a block the day no longer has: its label would say
  // neither where nor when. The Timeline changed, and Boxes cannot see that.
  const boxes = readBoxes(doc);
  const known = dayPlaces(doc);
  const lost = boxes.boxes.filter((box) => neededAt(box, known).lost).length;
  if (lost > 0) {
    out.push({
      id: "boxes-lost",
      severity: "blocking",
      message:
        lost === 1
          ? "A box is needed for a part of the day that is no longer on the Timeline."
          : `${lost} boxes are needed for parts of the day that are no longer on the Timeline.`,
      href: "/boxes",
      action: "Say where they are needed",
    });
  }

  // The last week: packing is a thing done before the day, like a task.
  const daysToGo = doc.event.date ? daysUntil(doc.event.date, today) : null;
  const { packed, total } = packingOf(boxes);
  if (daysToGo !== null && daysToGo >= 0 && daysToGo <= PACKING_DAYS && packed < total) {
    const left = total - packed;
    out.push({
      id: "boxes-unpacked",
      severity: "advisory",
      message: `${left} ${left === 1 ? "thing is" : "things are"} still to pack, and the day is ${
        daysToGo === 0 ? "today" : daysToGo === 1 ? "tomorrow" : `in ${daysToGo} days`
      }.`,
      href: "/boxes",
      action: "Finish packing",
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

  const late = checklist(crew, today).overdue;
  if (late.length > 0) {
    out.push({
      id: "tasks-overdue",
      severity: "advisory",
      message:
        late.length === 1
          ? `“${late[0]!.label}” was to be done by ${longDate(late[0]!.dueOn)}.`
          : `${late.length} tasks are past the date they were to be done by.`,
      href: "/checklist",
      action: "See the checklist",
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

  if (!over) out.push(...firstSteps(doc, raw, coming, seating, timeline));

  // A tool the wedding has removed is one it is not using: nothing in it is
  // left to do. Here rather than in the page, so the planner's Weddings page,
  // which runs this on the server, says the same.
  const hidden = hiddenToolIds(doc);
  return out.filter((item) => !hidden.has(TOOLS.find((tool) => tool.href === item.href)?.id ?? ""));
}

/**
 * What to do next on a wedding that is still being set up, each step when its
 * contents call for it: the room once there are guests, the place cards once
 * ten are seated, the ceremony's place once there is a day.
 */
function firstSteps(
  doc: Knotwork,
  raw: unknown,
  coming: ReturnType<typeof readGuests>[string][],
  seating: ReturnType<typeof readSeating>,
  timeline: ReturnType<typeof readTimeline>,
): Readiness[] {
  const out: Readiness[] = [];
  if (Object.keys(seating.tables).length === 0) {
    out.push({
      id: "room-undrawn",
      severity: "advisory",
      message: "Your guests are in. Draw the room and its tables next.",
      href: "/seating",
      action: "Draw the room",
    });
  }
  if (coming.filter((guest) => guest.assignedTableId !== null).length >= 10 && stationeryPieces(raw).length === 0) {
    out.push({
      id: "cards-undesigned",
      severity: "advisory",
      message: "Place cards already know every table. Design them when you are ready.",
      href: "/stationery",
      action: "Design place cards",
    });
  }
  if (timeline.blocks.length > 0 && readCeremony(doc).blockId === null) {
    out.push({
      id: "ceremony-unpinned",
      severity: "advisory",
      message: "The ceremony is not pinned to a part of the day yet.",
      href: "/ceremony",
      action: "Pin the ceremony",
    });
  }
  return out;
}
