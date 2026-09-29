import type { Trousseau } from "@jfrusher/trousseau";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { resolveMembers } from "@/lib/cast/resolve";
import { money } from "@/lib/money/money";
import { todayIso } from "@/lib/dates";
import { checklist } from "@/lib/checklist/checklist";
import { stationery } from "./readiness";
import { isComing, readBoxes, readCast, readCeremony, readCrew, readGuests, readSeating, readShots, resolvedDay } from "./slices";
import { dayPlaces, neededAt, packingOf } from "@/lib/boxes/view";
import { hiddenToolIds } from "./toolbox";

/**
 * How far along each part of the wedding is, for the front page.
 *
 * A measure, not a verdict: what is wrong across the tools is `readiness`'s
 * job, and each tool reports its own problems. This says how much there is and
 * how much of it is done, so the page reads as the wedding's state rather than
 * as a list of ways into it.
 */
export type AreaId =
  | "guests"
  | "money"
  | "checklist"
  | "seating"
  | "place-cards"
  | "timeline"
  | "delegation"
  | "group-shots"
  | "ceremony"
  | "boxes";

export interface Area {
  id: AreaId;
  /** What is there, in a phrase: "97 of 100 seated". */
  summary: string;
  /** One more line, or "" when there is nothing more to say. */
  detail: string;
  /** How far along, from 0 to 1, where there is a measure of it. */
  progress: number | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function guests(doc: Trousseau): Area {
  const people = Object.values(readGuests(doc));
  if (people.length === 0) return { id: "guests", summary: "No guest list yet", detail: "", progress: null };
  const yes = people.filter((g) => g.rsvpStatus === "confirmed").length;
  const no = people.filter((g) => g.rsvpStatus === "declined").length;
  const waiting = people.length - yes - no;
  return {
    id: "guests",
    summary: plural(people.length, "guest", "guests"),
    detail: [`${yes} said yes`, waiting > 0 ? `${waiting} yet to reply` : "", no > 0 ? `${no} said no` : ""]
      .filter(Boolean)
      .join(" · "),
    // Replies in: a no is as much an answer as a yes.
    progress: (yes + no) / people.length,
  };
}

function costs(doc: Trousseau): Area {
  const accounts = money(readCrew(doc));
  if (accounts.suppliers.length === 0) return { id: "money", summary: "No costs yet", detail: "", progress: null };
  return {
    id: "money",
    summary:
      accounts.budget === null
        ? `${accounts.committed.toLocaleString()} committed`
        : `${accounts.committed.toLocaleString()} of ${accounts.budget.toLocaleString()}`,
    detail: `${accounts.paid.toLocaleString()} paid · ${accounts.owed.toLocaleString()} to pay`,
    // Paid of what is agreed: how far through the paying the wedding is.
    progress: accounts.committed > 0 ? accounts.paid / accounts.committed : null,
  };
}

function tasks(doc: Trousseau, today: string): Area {
  const list = checklist(readCrew(doc), today);
  const open = list.overdue.length + list.comingUp.length + list.later.length + list.undated.length;
  const all = open + list.done.length;
  if (all === 0) return { id: "checklist", summary: "No tasks yet", detail: "", progress: null };
  return {
    id: "checklist",
    summary: open === 0 ? "All done" : `${open} to do`,
    detail: [
      `${list.done.length} done`,
      list.overdue.length > 0 ? `${list.overdue.length} late` : "",
      list.comingUp.length > 0 ? `${list.comingUp.length} due this month` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    progress: list.done.length / all,
  };
}

function seating(doc: Trousseau): Area {
  const tables = Object.keys(readSeating(doc).tables).length;
  if (tables === 0) return { id: "seating", summary: "No tables yet", detail: "", progress: null };
  const coming = Object.values(readGuests(doc)).filter(isComing);
  const seated = coming.filter((g) => g.assignedTableId !== null).length;
  return {
    id: "seating",
    summary: `${seated} of ${coming.length} seated`,
    detail: plural(tables, "table", "tables"),
    progress: coming.length > 0 ? seated / coming.length : null,
  };
}

function placeCards(doc: Trousseau, raw: unknown): Area {
  const design = stationery(raw);
  if (!design) return { id: "place-cards", summary: "No card design yet", detail: "", progress: null };
  // A card for everyone coming: the rows Place cards draws from the room.
  const cards = Object.values(readGuests(doc)).filter(isComing).length;
  return {
    id: "place-cards",
    summary: plural(cards, "card", "cards"),
    detail: design["fileName"] === "the room" ? "Drawn from the room" : "From an imported file",
    progress: null,
  };
}

function timeline(doc: Trousseau): Area {
  const blocks = resolvedDay(doc);
  if (blocks.length === 0) return { id: "timeline", summary: "No day yet", detail: "", progress: null };
  const start = Math.min(...blocks.map((b) => b.startMin));
  const end = Math.max(...blocks.map((b) => b.endMin));
  return {
    id: "timeline",
    summary: plural(blocks.length, "block", "blocks"),
    detail: `${formatClock(start)} to ${formatClock(end)}`,
    progress: null,
  };
}

function delegation(doc: Trousseau): Area {
  const crew = readCrew(doc);
  // The jobs on the day; the tasks before it are the Checklist's.
  const jobs = crew.jobs.filter((job) => job.blockId !== null);
  if (jobs.length === 0) return { id: "delegation", summary: "No jobs yet", detail: "", progress: null };
  const covered = jobs.filter((job) => job.personIds.length > 0).length;
  // Only suppliers with something to do on the day have anything to confirm,
  // as What is left counts them.
  const working = new Set(crew.jobs.map((job) => job.teamId).filter((id) => id !== null));
  const suppliers = crew.teams.filter((team) => working.has(team.id));
  const confirmed = suppliers.filter((team) => team.confirmedOn !== "").length;
  return {
    id: "delegation",
    summary: plural(jobs.length, "job", "jobs"),
    detail: [
      covered === jobs.length ? "All have somebody" : `${jobs.length - covered} with nobody`,
      suppliers.length > 0 ? `${confirmed} of ${suppliers.length} suppliers confirmed` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    progress: covered / jobs.length,
  };
}

function groupShots(doc: Trousseau): Area {
  const shots = readShots(doc);
  const cast = readCast(doc);
  const all = shots.sections.flatMap((section) => section.shots);
  if (all.length === 0) return { id: "group-shots", summary: "No shots yet", detail: "", progress: null };
  const guestList = readGuests(doc);
  const room = readSeating(doc);
  const troubled = all.filter(
    (shot) => resolveMembers(shot, guestList, room, cast.roles, cast.customRoles, doc.event).problems.length > 0,
  ).length;
  return {
    id: "group-shots",
    summary: plural(all.length, "shot", "shots"),
    detail: troubled > 0 ? `${troubled} to look at` : "",
    progress: null,
  };
}

function ceremony(doc: Trousseau): Area {
  const processional = readCeremony(doc).processional;
  if (processional.length === 0) return { id: "ceremony", summary: "No processional yet", detail: "", progress: null };
  const guestList = readGuests(doc);
  const room = readSeating(doc);
  const cast = readCast(doc);
  const troubled = processional.filter(
    (group) => resolveMembers(group, guestList, room, cast.roles, cast.customRoles, doc.event).problems.length > 0,
  ).length;
  return {
    id: "ceremony",
    summary: plural(processional.length, "group walking", "groups walking"),
    detail: troubled > 0 ? `${troubled} to look at` : "",
    progress: null,
  };
}

function boxes(doc: Trousseau): Area {
  const all = readBoxes(doc);
  if (all.boxes.length === 0) return { id: "boxes", summary: "No boxes yet", detail: "", progress: null };
  const { packed, total } = packingOf(all);
  const known = dayPlaces(doc);
  const lost = all.boxes.filter((box) => neededAt(box, known).lost).length;
  return {
    id: "boxes",
    summary: plural(all.boxes.length, "box", "boxes"),
    detail: [total > 0 ? `${packed} of ${total} packed` : "Nothing in them yet", lost > 0 ? `${lost} to look at` : ""].filter(Boolean).join(" · "),
    progress: total > 0 ? packed / total : null,
  };
}

/** Every area, less those of the tools the wedding has removed. */
export function overview(doc: Trousseau, raw: unknown, today: string = todayIso()): Area[] {
  const hidden = hiddenToolIds(doc);
  return [guests(doc), costs(doc), tasks(doc, today), seating(doc), placeCards(doc, raw), timeline(doc), delegation(doc), groupShots(doc), ceremony(doc), boxes(doc)].filter(
    (area) => !hidden.has(area.id),
  );
}
