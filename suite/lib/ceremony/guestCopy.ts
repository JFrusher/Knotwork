import type { Knotwork } from "@jfrusher/knotwork";
import { formatClock } from "@/lib/minutes";
import { roleLabel } from "@/lib/model/partners";
import { dayPlaces, guestName, isComing, readCast, readCeremony, readGuests, readSeating } from "@/lib/model/slices";
import { CAST_ROLES, type CastSlice, type Guest, type GuestCopy, type WordsLayout } from "@/lib/model/types";
import { ceremonyPlace } from "./checks";
import { orderRows, type OrderRow } from "./rows";

/** Words set one way: a reading as a poem, the vows as prose, the declarations as responses. */
export interface GuestPassage {
  text: string;
  layout: WordsLayout;
}

/**
 * One part of the ceremony as the guests are told it. Nothing for running the
 * day — no times, cues or notes — and words only where the couple chose them.
 */
export interface GuestBlock {
  title: string;
  /** "William Shakespeare", or "". */
  author: string;
  /** "Please stand", or "". */
  note: string;
  /** Who leads it, by name. */
  people: string[];
  /** Each piece of music, by name: one, or the processional's groups' several. */
  music: string[];
  /** Anything else said under its title: who is who, the day's times. */
  lines: string[];
  passages: GuestPassage[];
}

/**
 * The guests' copy of the order of service: what the booklet prints and the
 * guest link shows, made in one place so the two agree.
 */
export function guestBlocks(rows: OrderRow[], copy: GuestCopy): GuestBlock[] {
  return rows.map((row) => {
    const groupsMusic = copy.processionalMusic ? row.groups.map((group) => group.music).filter(Boolean) : [];
    const passages: GuestPassage[] = [];
    if (row.printWords && row.words) passages.push({ text: row.words, layout: row.layout });
    if (row.printLyrics && row.lyrics) passages.push({ text: row.lyrics, layout: "poem" });
    return {
      title: row.title,
      author: row.author,
      note: row.guestNote,
      people: row.people,
      music: [...(row.music ? [ownMusic(row)] : []), ...groupsMusic].filter(Boolean),
      lines: [],
      passages,
    };
  });
}

/** A song sung as its own part is already named by its title: say only whose it is. */
function ownMusic(row: OrderRow): string {
  if (row.music === row.title) return "";
  return row.music.startsWith(`${row.title} — `) ? row.music.slice(row.title.length + 3) : row.music;
}

/**
 * The wedding's guest copy, as it stands: what the booklet and the guest link
 * are made from. The couple's welcome, the ceremony, who is who, what happens
 * after, and their thanks — each only where they have written or chosen it.
 */
export function weddingGuestBlocks(doc: Knotwork): GuestBlock[] {
  const ceremony = readCeremony(doc);
  const places = dayPlaces(doc);
  const guests = readGuests(doc);
  const { place } = ceremonyPlace(ceremony, places);
  const copy = ceremony.guestCopy;
  const party = copy.weddingParty ? weddingParty(readCast(doc), guests, doc.event) : [];
  const after = copy.dayBlockIds
    .flatMap((id) => (places.has(id) ? [places.get(id)!] : []))
    .sort((a, b) => a.startMin - b.startMin)
    .map((block) => `${formatClock(block.startMin)}  ${block.label}${block.location ? ` — ${block.location}` : ""}`);
  return [
    ...(copy.welcome.trim() ? [note(copy.welcome)] : []),
    ...guestBlocks(orderRows(ceremony, guests, readSeating(doc), readCast(doc), doc.event, place), copy),
    ...(party.length > 0 ? [section("The wedding party", party)] : []),
    ...(after.length > 0 ? [section("After the ceremony", after)] : []),
    ...(copy.thanks.trim() ? [note(copy.thanks)] : []),
  ];
}

/** Each role of the cast with somebody in it, the couple themselves aside: "Sam’s mother: Lucia Reyes". */
function weddingParty(cast: CastSlice, guests: Record<string, Guest>, event: Knotwork["event"]): string[] {
  const names = (ids: string[]) =>
    ids.flatMap((id) => (guests[id] && isComing(guests[id]) ? [guestName(guests[id])] : [])).filter(Boolean).join(", ");
  const fixed = CAST_ROLES.filter((role) => role !== "a" && role !== "b").map((role) => [roleLabel(role, event), names(cast.roles[role])]);
  const own = cast.customRoles.map((role) => [role.name, names(role.guestIds)]);
  return [...fixed, ...own].filter(([, who]) => who).map(([role, who]) => `${role}: ${who}`);
}

/** A part of the booklet that is not of the ceremony: a heading and its lines. */
const section = (title: string, lines: string[]): GuestBlock => ({ title, author: "", note: "", people: [], music: [], lines, passages: [] });

/** The couple's own words, with no heading, line by line as they wrote them: a welcome, a thank-you. */
const note = (text: string): GuestBlock => ({ title: "", author: "", note: "", people: [], music: [], lines: [], passages: [{ text: text.trim(), layout: "poem" }] });

/** A line of responses everyone says — "All: We will." — set apart in print and on screen. */
export function isEveryone(line: string): boolean {
  return /^\s*all\s*:/i.test(line);
}
