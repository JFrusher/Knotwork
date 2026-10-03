import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import type { FontSource } from "@/apps/brigade/render/pdf/fontSource";
import { longDate } from "@/lib/dates";
import { coupleTitle } from "@/lib/model/partners";
import type { Place } from "@/lib/model/slices";
import type { OrderRow } from "../../rows";
import { renderFlow, type FlowBlock, type FlowLine } from "./flow";

export interface OrderOfServiceOptions {
  fontSource: FontSource;
  event: Pick<WeddingEvent, "partners" | "date" | "venueName">;
  where: Place | null;
}

/**
 * The order of service for the guests, on A5: each part's title, who reads
 * or sings, and the music — with the words and lyrics in full only where the
 * couple chose to print them. Nothing for running the day: no times, cues or
 * notes.
 */
export async function renderOrderOfService(rows: OrderRow[], options: OrderOfServiceOptions): Promise<Uint8Array> {
  const blocks: FlowBlock[] = rows.map((row) => {
    const lines: FlowLine[] = [{ text: row.title, bold: true, sizePt: 11, center: true }];
    if (row.people.length > 0) lines.push({ text: row.people.join(" and "), center: true, muted: true });
    // A song sung as its own part is already named by its title: say only whose it is.
    const music = row.music.startsWith(`${row.title} — `) ? row.music.slice(row.title.length + 3) : row.music === row.title ? "" : row.music;
    if (music) lines.push({ text: music, center: true });
    if (row.print && row.words) lines.push({ text: row.words, center: true });
    if (row.print && row.lyrics) lines.push({ text: row.lyrics, center: true });
    return { lines };
  });
  const title = coupleTitle(options.event.partners);
  const date = options.event.date ? longDate(options.event.date) : "";
  const venue = options.where?.location || options.event.venueName;
  return renderFlow(blocks, {
    fontSource: options.fontSource,
    size: "A5",
    title: title ? `The marriage of ${title}` : "The order of service",
    subtitle: [date, venue].filter(Boolean).join(" · ") || undefined,
    centred: true,
  });
}
