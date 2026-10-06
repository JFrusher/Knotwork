import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import type { FontSource } from "@/lib/pdf/fontSource";
import { longDate } from "@/lib/dates";
import { coupleTitle } from "@/lib/model/partners";
import type { Place } from "@/lib/model/slices";
import { isCongregation, type GuestBlock, type GuestPassage } from "../../guestCopy";
import { renderFlow, type FlowBlock, type FlowLine } from "./flow";

interface OrderOfServiceOptions {
  fontSource: FontSource;
  event: Pick<WeddingEvent, "partners" | "date" | "venueName">;
  where: Place | null;
}

/**
 * The order of service for the guests, on A5: each part's title, whose words,
 * who reads or sings, the music, and the words and lyrics the couple chose to
 * print. Nothing for running the day: no times, cues or notes.
 */
export async function renderOrderOfService(blocks: GuestBlock[], options: OrderOfServiceOptions): Promise<Uint8Array> {
  const flow: FlowBlock[] = blocks.map((block) => {
    const lines: FlowLine[] = [{ text: block.title, bold: true, sizePt: 11, center: true }];
    if (block.author) lines.push({ text: block.author, center: true, muted: true });
    if (block.note) lines.push({ text: block.note, center: true, muted: true });
    if (block.people.length > 0) lines.push({ text: block.people.join(" and "), center: true, muted: true });
    for (const music of block.music) lines.push({ text: music, center: true });
    for (const passage of block.passages) lines.push(...passageLines(passage));
    return { lines };
  });
  const title = coupleTitle(options.event.partners);
  const date = options.event.date ? longDate(options.event.date) : "";
  const venue = options.where?.location || options.event.venueName;
  return renderFlow(flow, {
    fontSource: options.fontSource,
    size: "A5",
    title: title ? `The marriage of ${title}` : "The order of service",
    subtitle: [date, venue].filter(Boolean).join(" · ") || undefined,
    centred: true,
  });
}

/** A poem centred line by line; prose and responses from the left, the congregation's lines in bold. */
function passageLines(passage: GuestPassage): FlowLine[] {
  if (passage.layout === "poem") return [{ text: passage.text, center: true }];
  if (passage.layout === "prose") return [{ text: passage.text }];
  return passage.text.split("\n").map((line) => ({ text: line, bold: isCongregation(line) }));
}
