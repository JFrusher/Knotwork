import type { GuestCopy, WordsLayout } from "@/lib/model/types";
import type { OrderRow } from "./rows";

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
      passages,
    };
  });
}

/** A song sung as its own part is already named by its title: say only whose it is. */
function ownMusic(row: OrderRow): string {
  if (row.music === row.title) return "";
  return row.music.startsWith(`${row.title} — `) ? row.music.slice(row.title.length + 3) : row.music;
}

/** A line of responses spoken by everyone: "All: We will." */
export function isCongregation(line: string): boolean {
  return /^\s*all\s*:/i.test(line);
}
