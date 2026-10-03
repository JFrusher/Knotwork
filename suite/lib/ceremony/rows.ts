import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { resolveMembers } from "@/lib/cast/resolve";
import { coupleTitle, sideLabel } from "@/lib/model/partners";
import type { Place } from "@/lib/model/slices";
import type { CastSlice, Ceremony, Formation, Guest, MomentKind, Seating, WalkGroup } from "@/lib/model/types";
import { startTimes } from "./checks";
import { songName, songPlaying } from "./music";

export const FORMATION_WORDS: Record<Formation, string> = {
  single: "One at a time",
  pairs: "In pairs",
  threes: "In threes",
};

/** One group as it is read out or printed: the page and the email are made from these, so they agree. */
export interface ProcessionalRow {
  number: number;
  label: string;
  /** The people walking, by name; empty for a group of words alone. */
  people: string[];
  /** "In pairs, to Alex’s side". */
  how: string;
  /** The piece starting as they walk, "Canon in D — Pachelbel", or "". */
  music: string;
  /** How it is played: "String quartet, from 0:45". */
  playing: string;
  cue: string;
  trouble: boolean;
}

export function processionalRows(
  processional: WalkGroup[],
  guests: Record<string, Guest>,
  seating: Seating,
  cast: CastSlice,
  event: Pick<WeddingEvent, "partners">,
): ProcessionalRow[] {
  return processional.map((group, index) => {
    const resolved = resolveMembers(group, guests, seating, cast.roles, cast.customRoles, event);
    const side = sideLabel(group.side, event);
    const people = resolved.people.map((person) => person.name);
    return {
      number: index + 1,
      label: resolved.label,
      // Words standing in for somebody — "The officiant" — are the label already.
      people: people.join(", ") === resolved.label ? [] : people,
      // "to Alex’s side", "to both sides": a name keeps its capital.
      how: side ? `${FORMATION_WORDS[group.formation]}, to ${group.side === "both" ? "both sides" : side}` : FORMATION_WORDS[group.formation],
      music: group.song ? songName(group.song) : "",
      playing: group.song ? songPlaying(group.song) : "",
      cue: group.cue.trim(),
      trouble: resolved.problems.length > 0,
    };
  });
}

/** The processional as plain text, to paste into an email to the wedding party. */
export function processionalText(rows: ProcessionalRow[], event: Pick<WeddingEvent, "partners">): string {
  const title = coupleTitle(event.partners);
  const lines = [title ? `The processional — ${title}` : "The processional", ""];
  for (const row of rows) {
    lines.push(`${row.number}. ${row.label}`);
    if (row.people.length > 0) lines.push(`   ${row.people.join(", ")}`);
    lines.push(`   ${row.how}.`);
    const music = [row.music && `Music: ${row.music}${row.playing ? ` (${row.playing})` : ""}.`, row.cue && `${row.cue}.`].filter(Boolean).join(" ");
    if (music) lines.push(`   ${music}`);
  }
  return lines.join("\n");
}

/** One moment of the order of service as it is printed or read out: every page and the email are made from these. */
export interface OrderRow {
  number: number;
  kind: MomentKind;
  /** "14:03", "Before" for music as guests arrive, or "" with no part of the day chosen. */
  time: string;
  title: string;
  /** Who leads it, by name. */
  people: string[];
  minutes: number | null;
  cue: string;
  music: string;
  playing: string;
  words: string;
  lyrics: string;
  /** Its words and lyrics go in full into the guests' order of service. */
  print: boolean;
  notes: string;
  trouble: boolean;
  /** The processional's groups, for the moment it happens. */
  groups: ProcessionalRow[];
}

export function orderRows(
  ceremony: Ceremony,
  guests: Record<string, Guest>,
  seating: Seating,
  cast: CastSlice,
  event: Pick<WeddingEvent, "partners">,
  place: Place | null,
): OrderRow[] {
  const times = startTimes(ceremony.order, place?.startMin ?? 0);
  const groups = processionalRows(ceremony.processional, guests, seating, cast, event);
  return ceremony.order.map((moment, index) => {
    const resolved = resolveMembers({ label: moment.title, members: moment.members }, guests, seating, cast.roles, cast.customRoles, event);
    const at = times[index] ?? null;
    return {
      number: index + 1,
      kind: moment.kind,
      time: at === null ? "Before" : place ? formatClock(at) : "",
      title: moment.title.trim() || "A moment",
      people: moment.members.length > 0 ? resolved.people.map((person) => person.name) : [],
      minutes: moment.minutes,
      cue: moment.cue.trim(),
      music: moment.song ? songName(moment.song) : "",
      playing: moment.song ? songPlaying(moment.song) : "",
      words: moment.words.trim(),
      lyrics: moment.song?.lyrics.trim() ?? "",
      print: moment.print,
      notes: moment.notes.trim(),
      trouble: moment.members.length > 0 && resolved.problems.length > 0,
      groups: moment.kind === "processional" ? groups : [],
    };
  });
}

/** The order of service as plain text, for the officiant or the wedding party. */
export function orderText(rows: OrderRow[], event: Pick<WeddingEvent, "partners">): string {
  const title = coupleTitle(event.partners);
  const lines = [title ? `The order of service — ${title}` : "The order of service", ""];
  for (const row of rows) {
    lines.push(`${row.time ? `${row.time}  ` : ""}${row.number}. ${row.title}${row.minutes ? ` (${row.minutes} min)` : ""}`);
    if (row.people.length > 0) lines.push(`   ${row.people.join(", ")}`);
    if (row.cue) lines.push(`   Cue: ${row.cue}`);
    if (row.music) lines.push(`   Music: ${row.music}${row.playing ? ` (${row.playing})` : ""}`);
    for (const group of row.groups) {
      lines.push(`   ${group.number}) ${group.label}${group.people.length > 0 ? ` — ${group.people.join(", ")}` : ""}, ${group.how.toLowerCase()}`);
      if (group.music || group.cue) lines.push(`      ${[group.music && `Music: ${group.music}`, group.cue].filter(Boolean).join(". ")}`);
    }
    if (row.notes) lines.push(`   Note: ${row.notes}`);
  }
  return lines.join("\n");
}
