import { tagLabel } from "../../core/model/tags";
import type { TimelineDoc } from "../../core/model/types";
import { resolve } from "../../core/schedule/resolve";

/**
 * The day as a calendar file (RFC 5545): every block, or one tag's — a
 * supplier's own part of the day, for their own calendar.
 *
 * Times are the venue's clock, written as local times with no zone ("floating"
 * in the RFC's word): the ceremony at 13:30 is at 13:30 on every phone, as it
 * is in the Binder. Not UTC, because turning the venue's clock into UTC needs
 * the day's offset, which a wedding may not have set — and the venue's clock
 * is the one everybody there on the day is reading.
 */

export interface CalendarOptions {
  /** The wedding's date, `YYYY-MM-DD`: the wedding's own, never the timeline's placeholder. */
  date: string;
  /** One tag's blocks; every block when absent. */
  tag?: string;
  /** When the file was made. Every event carries it. */
  now: Date;
}

const CRLF = "\r\n";

/** Text as a calendar reads it: backslashes, semicolons, commas and line breaks escaped. */
export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A line folded at 75 octets, as the RFC asks, and never through a character. */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // A continuation starts with a space, which counts.
    const limit = lines.length === 0 ? 75 : 74;
    if (octets + size > limit) {
      lines.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  lines.push(current);
  return lines.join(`${CRLF} `);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** A minute of the day, on the wedding's date, as a local time: past midnight is the next day. */
function localTime(date: string, minutes: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const at = new Date(Date.UTC(year!, month! - 1, day!, 0, minutes));
  return `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}00`;
}

const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function calendar(doc: TimelineDoc, options: CalendarOptions): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error("A calendar needs the wedding's date.");

  const positions = new Map(resolve(doc).map((entry) => [entry.id, entry]));
  const couple = doc.day.coupleNames.trim();
  const title = [couple || "The wedding", options.tag === undefined ? "" : tagLabel(doc, options.tag)].filter(Boolean).join(" — ");
  // Stable, so importing the file again updates the events rather than doubling
  // them; and particular to this wedding, because two weddings' days can share
  // block ids when one was started from the other's running order.
  const uidSuffix = `${options.date}.${slug(couple) || "wedding"}@knotwork`;

  const events = doc.blocks
    .filter((block) => options.tag === undefined || block.tags.includes(options.tag))
    .flatMap((block) => {
      const at = positions.get(block.id);
      return at ? [{ block, at }] : [];
    })
    .sort((a, b) => a.at.startMin - b.at.startMin)
    .flatMap(({ block, at }) => [
      "BEGIN:VEVENT",
      `UID:${block.id}.${uidSuffix}`,
      `DTSTAMP:${stamp(options.now)}`,
      `DTSTART:${localTime(options.date, at.startMin)}`,
      // An end only where there is a length: the RFC wants it after the start,
      // and an event with only a start is exactly what a moment is.
      ...(at.contentEndMin > at.startMin ? [`DTEND:${localTime(options.date, at.contentEndMin)}`] : []),
      `SUMMARY:${escapeText(block.label)}`,
      ...(block.location.trim() ? [`LOCATION:${escapeText(block.location.trim())}`] : []),
      ...(block.notes.trim() ? [`DESCRIPTION:${escapeText(block.notes.trim())}`] : []),
      "END:VEVENT",
    ]);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Knotwork//Timeline//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(title)}`,
    ...events,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join(CRLF)
    .concat(CRLF);
}
