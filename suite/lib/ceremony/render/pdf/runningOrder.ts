import { formatClock } from "@/lib/minutes";
import type { FontSource } from "@/lib/pdf/fontSource";
import type { Place } from "@/lib/model/slices";
import { titled, type OrderRow } from "../../rows";
import { renderFlow, type FlowBlock, type FlowLine } from "./flow";

interface RunningOrderOptions {
  fontSource: FontSource;
  coupleNames: string;
  officiant: string;
  where: Place | null;
  generatedOn?: string;
}

/**
 * The ceremony for the officiant and whoever runs the day: every part in
 * order, when it starts, who leads it, its cue, the music from where to where,
 * the notes, and the processional where they walk. Words are left to the
 * order of service: this is for running it, not reading it.
 */
export async function renderRunningOrder(rows: OrderRow[], options: RunningOrderOptions): Promise<Uint8Array> {
  const blocks: FlowBlock[] = rows.map((row) => {
    const lines: FlowLine[] = [{ text: `${row.number}. ${titled(row)}${row.minutes ? `  ·  ${row.minutes} min` : ""}`, bold: true }];
    if (row.people.length > 0) lines.push({ text: row.people.join(", ") });
    if (row.cue) lines.push({ text: `Cue: ${row.cue}` });
    if (row.music) lines.push({ text: `Music: ${row.music}${row.playing ? ` — ${row.playing}` : ""}` });
    for (const group of row.groups) {
      lines.push({ text: `${group.number}) ${group.label}${group.people.length > 0 ? ` — ${group.people.join(", ")}` : ""}. ${group.how}.`, indentMm: 4 });
      const music = [group.music && `Music: ${group.music}${group.playing ? ` — ${group.playing}` : ""}`, group.cue && `Cue: ${group.cue}`].filter(Boolean).join(". ");
      if (music) lines.push({ text: music, indentMm: 8, muted: true });
    }
    if (row.notes) lines.push({ text: row.notes, muted: true });
    return { lines, time: row.time || undefined, marked: row.trouble || row.groups.some((group) => group.trouble) };
  });
  const place = options.where;
  const subtitle = [
    options.officiant,
    place && `${formatClock(place.startMin)}${place.location ? `, ${place.location}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return renderFlow(blocks, {
    fontSource: options.fontSource,
    size: "A4",
    title: options.coupleNames ? `The running order — ${options.coupleNames}` : "The running order",
    subtitle: subtitle || undefined,
    generatedOn: options.generatedOn,
  });
}
