// Delegation's page, table, text and font kit, as the other ceremony pages use
// it: see the note at the top of lib/group-shots/render/pdf/shotSheet.ts.
import { PDFDocument, type PDFFont } from "pdf-lib";
import { embedFamily } from "@/lib/pdf/embedFonts";
import type { FontSource } from "@/lib/pdf/fontSource";
import { addSheet, hexColour, type Colour } from "@/lib/pdf/page";
import { paginate } from "@/lib/pdf/table";
import { wrap } from "@/lib/pdf/text";
import { contentBox, PAGE_SIZES, ptToMm } from "@/lib/pdf/units";

/** One line of a block, before wrapping. */
export interface FlowLine {
  text: string;
  bold?: boolean;
  sizePt?: number;
  muted?: boolean;
  indentMm?: number;
}

/** Lines that stay together on a page: one moment, one piece of music. */
export interface FlowBlock {
  lines: FlowLine[];
  /** In the left-hand column beside the first line: "14:03". */
  time?: string;
  /** A mark in the margin, where the screen shows one. */
  marked?: boolean;
}

interface FlowOptions {
  fontSource: FontSource;
  size: "A4" | "A5";
  title: string;
  subtitle?: string;
  generatedOn?: string;
}

const ACCENT = "#46617a";
const BODY_PT = 9.5;
const LEADING = 1.35;
const TIME_COL_MM = 14;
const BLOCK_GAP_MM = 3;
const MUTED: Colour = { r: 0.44, g: 0.43, b: 0.41 };
const DANGER: Colour = { r: 0.64, g: 0.23, b: 0.17 };

interface Wrapped {
  text: string;
  font: PDFFont;
  sizePt: number;
  muted: boolean;
  xMm: number;
}

const heightOf = (lines: Wrapped[]) => lines.reduce((sum, line) => sum + ptToMm(line.sizePt * LEADING), 0) + BLOCK_GAP_MM;

/** Blocks of text flowed down pages, each kept whole, with a header on every page. */
export async function renderFlow(blocks: FlowBlock[], options: FlowOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFamily(pdf, await options.fontSource("Lato"));
  const size = PAGE_SIZES[options.size];
  const margin = options.size === "A5" ? 14 : 15;
  const box = contentBox(size, margin);
  const timed = blocks.some((block) => block.time !== undefined);
  const textX = box.xMm + (timed ? TIME_COL_MM : 0);
  const textWidth = box.widthMm - (timed ? TIME_COL_MM : 0);
  const headerMm = options.subtitle ? 22 : 16;

  const measured = blocks.map((block) => {
    const lines: Wrapped[] = block.lines.flatMap((line) => {
      const font = line.bold ? bold : regular;
      const sizePt = line.sizePt ?? BODY_PT;
      const indent = line.indentMm ?? 0;
      // A blank line in typed words is a gap, kept rather than wrapped away.
      return line.text.split("\n").flatMap((part) =>
        (part.trim() === "" ? [""] : wrap(part, font, sizePt, textWidth - indent)).map((text) => ({
          text,
          font,
          sizePt,
          muted: line.muted ?? false,
          xMm: textX + indent,
        })),
      );
    });
    return { block, lines, heightMm: heightOf(lines) };
  });

  const available = box.heightMm - headerMm - 10;
  // A block taller than a page is cut between lines and carries on overleaf;
  // only its first part has the time and the mark.
  const runs = measured.flatMap((entry) => {
    if (entry.heightMm <= available) return [entry];
    const parts: (typeof entry)[] = [];
    let part: Wrapped[] = [];
    for (const line of entry.lines) {
      if (part.length > 0 && heightOf([...part, line]) > available) {
        parts.push({ block: parts.length === 0 ? entry.block : { lines: [] }, lines: part, heightMm: heightOf(part) });
        part = [];
      }
      part.push(line);
    }
    parts.push({ block: parts.length === 0 ? entry.block : { lines: [] }, lines: part, heightMm: heightOf(part) });
    return parts;
  });

  const pages = paginate(runs, available);
  pages.forEach((indices, pageIndex) => {
    const sheet = addSheet(pdf, size);
    const y0 = box.yMm;
    sheet.text(options.title, { xMm: box.xMm, yMm: y0 + 6, font: bold, sizePt: 14 });
    if (options.subtitle) {
      sheet.text(options.subtitle, { xMm: box.xMm, yMm: y0 + 12, font: regular, sizePt: 9, colour: MUTED });
    }
    if (pages.length > 1) {
      sheet.text(`Page ${pageIndex + 1} of ${pages.length}`, { xMm: box.xMm + box.widthMm, yMm: y0 + 6, font: regular, sizePt: 8, colour: MUTED, alignRight: true });
    }
    const ruleY = y0 + headerMm - 5;
    sheet.line(box.xMm, ruleY, box.xMm + box.widthMm, ruleY, { widthPt: 1, colour: hexColour(ACCENT) });

    let y = y0 + headerMm;
    for (const index of indices) {
      const entry = runs[index];
      if (!entry) continue;
      const first = entry.lines[0];
      if (entry.block.time && first) {
        sheet.text(entry.block.time, { xMm: box.xMm, yMm: y + ptToMm(first.sizePt * LEADING), font: regular, sizePt: BODY_PT, colour: MUTED });
      }
      if (entry.block.marked) sheet.rect(box.xMm - 3.5, y + 1.2, 1.4, ptToMm(BODY_PT * LEADING) * 0.8, { colour: DANGER });
      let lineY = y;
      for (const line of entry.lines) {
        lineY += ptToMm(line.sizePt * LEADING);
        if (!line.text) continue;
        sheet.text(line.text, { xMm: line.xMm, yMm: lineY, font: line.font, sizePt: line.sizePt, colour: line.muted ? MUTED : undefined });
      }
      y += entry.heightMm;
    }
    if (options.generatedOn) {
      sheet.text(options.generatedOn, { xMm: box.xMm, yMm: size.heightMm - margin + 4, font: regular, sizePt: 7, colour: MUTED });
    }
  });

  return pdf.save();
}
