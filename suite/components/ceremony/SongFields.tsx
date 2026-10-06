"use client";

import { useState } from "react";
import { TextArea, TextField } from "@/components/ui/controls";
import { formatSec, parseTime } from "@/lib/ceremony/music";
import type { Song } from "@/lib/model/types";

const FIELD = "w-full rounded border border-charcoal/15 bg-parchment px-2 py-1.5 text-sm text-charcoal focus:border-gold";

/**
 * A time in the track, typed as 0:45: written when the field is left, and
 * refused with a word rather than stored wrong.
 */
function TimeInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (sec: number | null) => void }) {
  const [problem, setProblem] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate">{label}</span>
      <input
        key={value ?? "none"}
        aria-label={label}
        defaultValue={value === null ? "" : formatSec(value)}
        placeholder="0:00"
        inputMode="numeric"
        onBlur={(event) => {
          const sec = parseTime(event.target.value);
          setProblem(sec === undefined);
          if (sec !== undefined && sec !== value) onCommit(sec);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={`${FIELD} tabular-nums ${problem ? "border-danger" : ""}`}
      />
      {problem && <span className="mt-1 block text-xs text-danger">Type it as minutes and seconds, like 0:45.</span>}
    </label>
  );
}

/** Every part of a song: which track, who plays it, from where to where, and its words. */
export function SongFields({ song, onChange }: { song: Song; onChange: (song: Song) => void }) {
  const patch = (change: Partial<Song>) => onChange({ ...song, ...change });
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Title" value={song.title} onChange={(title) => patch({ title })} placeholder="e.g. Canon in D" />
        <TextField label="Artist or composer" value={song.artist} onChange={(artist) => patch({ artist })} placeholder="e.g. Pachelbel" />
      </div>
      <TextField label="Arrangement" value={song.arrangement} onChange={(arrangement) => patch({ arrangement })} placeholder="e.g. arranged for string quartet" />
      <TextField label="Played by" value={song.playedBy} onChange={(playedBy) => patch({ playedBy })} placeholder="e.g. String quartet, the organist, a recording" />
      <div className="grid grid-cols-2 gap-2">
        <TimeInput label="Start the track at" value={song.startSec} onCommit={(startSec) => patch({ startSec })} />
        <TimeInput label="Fade it at" value={song.endSec} onCommit={(endSec) => patch({ endSec })} />
      </div>
      <TextArea label="Lyrics — for the singers, or the order of service" value={song.lyrics} onChange={(lyrics) => patch({ lyrics })} rows={5} />
    </div>
  );
}
