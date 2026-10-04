import { migrate } from "@jfrusher/knotwork";
import { choices } from "@/lib/bar/actions";
import { readBar, readBoxes, readCeremony, readCrew, readGuests, readSeating, readShots } from "./slices";

/**
 * What a wedding holds, in the terms a person would recognise it by.
 *
 * Counts what somebody entered, never whether a slice exists. Opening
 * Timeline, Place cards or Delegation stores that tool's empty defaults
 * without anyone typing a thing, so "a slice is there" says nothing about
 * whether there is work in it to lose.
 */
export interface WeddingSummary {
  names: string;
  date: string;
  venue: string;
  guests: number;
  tables: number;
  blocks: number;
  crew: number;
  jobs: number;
  shots: number;
  /** Groups in the processional. */
  walking: number;
  boxes: number;
  /** Things chosen on the Bar: a figure changed, a price typed. */
  bar: number;
}

export function summarise(raw: unknown): WeddingSummary {
  const doc = migrate(raw);
  const crew = readCrew(doc);
  return {
    names: doc.event.coupleNames.trim(),
    date: doc.event.date,
    venue: doc.event.venueName.trim(),
    guests: Object.keys(readGuests(doc)).length,
    tables: Object.keys(readSeating(doc).tables).length,
    blocks: doc.day?.blocks.length ?? 0,
    crew: crew.people.length,
    jobs: crew.jobs.length,
    shots: readShots(doc).sections.reduce((sum, section) => sum + section.shots.length, 0),
    walking: readCeremony(doc).processional.length,
    boxes: readBoxes(doc).boxes.length,
    bar: choices(readBar(doc)),
  };
}

/** Anything here that somebody would be sorry to lose. */
export function hasContent(summary: WeddingSummary): boolean {
  const { names, date, venue, ...counts } = summary;
  return names !== "" || date !== "" || venue !== "" || Object.values(counts).some((n) => n > 0);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Alex & Sam — 100 guests, 12 tables, 30 blocks of the day". */
export function describe(summary: WeddingSummary): string {
  const parts = [
    summary.guests && plural(summary.guests, "guest"),
    summary.tables && plural(summary.tables, "table"),
    summary.blocks && `${plural(summary.blocks, "block")} of the day`,
    summary.crew && plural(summary.crew, "person", "people") + " in the crew",
    summary.jobs && plural(summary.jobs, "job"),
    summary.shots && plural(summary.shots, "group shot"),
    summary.walking && `${plural(summary.walking, "group")} in the processional`,
    summary.boxes && plural(summary.boxes, "box", "boxes"),
    summary.bar && plural(summary.bar, "choice", "choices") + " for the bar",
  ].filter(Boolean);
  const name = summary.names || "A wedding with no names yet";
  return parts.length > 0 ? `${name} — ${parts.join(", ")}` : name;
}
