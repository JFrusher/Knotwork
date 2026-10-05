import type { Knotwork } from "@jfrusher/knotwork";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { resolveMembers } from "@/lib/cast/resolve";
import { money } from "@/lib/money/money";
import { todayIso } from "@/lib/dates";
import { checklist } from "@/lib/checklist/checklist";
import { stationeryPieces } from "./readiness";
import { dayPlaces, isComing, readBoxes, readCast, readCeremony, readCrew, readGuests, readSeating, readShots, resolvedDay } from "./slices";
import { neededAt, packingOf } from "@/lib/boxes/view";
import { hiddenToolIds } from "./toolbox";
import { lengthOf } from "@/lib/ceremony/checks";
import { barSum } from "@/lib/bar/sum";

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
  | "boxes"
  | "bar";

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

function guests(doc: Knotwork): Area {
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

function costs(doc: Knotwork): Area {
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

function tasks(doc: Knotwork, today: string): Area {
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

function seating(doc: Knotwork): Area {
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

function placeCards(doc: Knotwork, raw: unknown): Area {
  const pieces = stationeryPieces(raw);
  if (pieces.length === 0) return { id: "place-cards", summary: "No card design yet", detail: "", progress: null };
  // A card for everyone coming: the rows Place cards draws from the room.
  const cards = Object.values(readGuests(doc)).filter(isComing).length;
  return {
    id: "place-cards",
    summary: plural(cards, "card", "cards"),
    detail: pieces.length === 1 ? "Drawn from the room" : `${pieces.length} pieces, drawn from the room`,
    progress: null,
  };
}

function timeline(doc: Knotwork): Area {
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

function delegation(doc: Knotwork): Area {
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

function groupShots(doc: Knotwork): Area {
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

function ceremony(doc: Knotwork): Area {
  const { order, processional, witnesses } = readCeremony(doc);
  if (order.length === 0 && processional.length === 0) return { id: "ceremony", summary: "No ceremony planned yet", detail: "", progress: null };
  const guestList = readGuests(doc);
  const room = readSeating(doc);
  const cast = readCast(doc);
  const named = [
    ...processional,
    ...order.filter((moment) => moment.members.length > 0).map((moment) => ({ label: moment.title, members: moment.members })),
    ...(witnesses.length > 0 ? [{ label: "The witnesses", members: witnesses }] : []),
  ];
  const troubled = named.filter(
    (group) => resolveMembers(group, guestList, room, cast.roles, cast.customRoles, doc.event).problems.length > 0,
  ).length;
  const minutes = lengthOf(order);
  return {
    id: "ceremony",
    summary: order.length > 0 ? `${plural(order.length, "part", "parts")}${minutes > 0 ? `, ${minutes} minutes` : ""}` : plural(processional.length, "group walking", "groups walking"),
    detail: [order.length > 0 && processional.length > 0 ? plural(processional.length, "group walking", "groups walking") : "", troubled > 0 ? `${troubled} to look at` : ""]
      .filter(Boolean)
      .join(" · "),
    progress: null,
  };
}

function boxes(doc: Knotwork): Area {
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

function bar(doc: Knotwork): Area {
  const { heads, spend, unpriced } = barSum(doc);
  if (heads.people + heads.evening === 0) return { id: "bar", summary: "No guests to buy for yet", detail: "", progress: null };
  const priced = spend > 0 ? `About ${Math.round(spend).toLocaleString()}${unpriced > 0 ? `, ${plural(unpriced, "line", "lines")} with no price` : ""}` : "No prices yet";
  return {
    id: "bar",
    summary: `Drinks for ${heads.people}${heads.evening > 0 ? `, and ${heads.evening} in the evening` : ""}`,
    detail: priced,
    progress: null,
  };
}

/** Every area, less those of the tools the wedding has removed. */
export function overview(doc: Knotwork, raw: unknown, today: string = todayIso()): Area[] {
  const hidden = hiddenToolIds(doc);
  return [guests(doc), costs(doc), tasks(doc, today), seating(doc), placeCards(doc, raw), timeline(doc), delegation(doc), groupShots(doc), ceremony(doc), boxes(doc), bar(doc)].filter(
    (area) => !hidden.has(area.id),
  );
}
