import type { Ceremony, Song } from "@/lib/model/types";

/** 45 → "0:45", 125 → "2:05". */
export function formatSec(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/**
 * A time in a track as typed: "0:45", "2:05", or "45" for seconds alone.
 * Nothing typed is null; anything else unreadable is undefined, so the field
 * can say so rather than store a wrong time.
 */
export function parseTime(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const match = /^(?:(\d+):)?(\d{1,2})$/.exec(trimmed);
  if (!match) return undefined;
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds > 59) return undefined;
  return Number(match[1] ?? 0) * 60 + seconds;
}

/** "Canon in D — Pachelbel", or "Here Comes the Sun — The Beatles, arranged for strings": the name a song goes by. */
export function songName(song: Song): string {
  const name = [song.title.trim() || "A piece not chosen yet", song.artist.trim()].filter(Boolean).join(" — ");
  return song.arrangement.trim() ? `${name}, ${song.arrangement.trim()}` : name;
}

/** "String quartet, from 0:45 to 2:30": how it is played, for whoever is playing it. */
export function songPlaying(song: Song): string {
  const range =
    song.startSec !== null && song.endSec !== null
      ? `from ${formatSec(song.startSec)} to ${formatSec(song.endSec)}`
      : song.startSec !== null
        ? `from ${formatSec(song.startSec)}`
        : song.endSec !== null
          ? `fade at ${formatSec(song.endSec)}`
          : "";
  return [song.playedBy.trim(), range].filter(Boolean).join(", ");
}

/** One piece of music in the ceremony, where it falls, and when it starts. */
export interface MusicCue {
  /** "The processional — Alex's parents", "Signing the register". */
  where: string;
  cue: string;
  song: Song;
}

/**
 * Every piece of music in the ceremony, in the order it plays: each moment's,
 * with the processional's groups where the processional is in the order. The
 * musicians' sheet and the Timeline's cues are made from this.
 */
export function musicCues(ceremony: Ceremony, groupLabel: (groupId: string) => string): MusicCue[] {
  return ceremony.order.flatMap((moment): MusicCue[] => {
    const own = moment.song ? [{ where: moment.title || "A moment", cue: moment.cue.trim(), song: moment.song }] : [];
    if (moment.kind !== "processional") return own;
    const groups = ceremony.processional
      .filter((group) => group.song !== null)
      .map((group) => ({ where: `${moment.title || "The processional"} — ${groupLabel(group.id)}`, cue: group.cue.trim(), song: group.song! }));
    return [...own, ...groups];
  });
}
