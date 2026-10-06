// Brigade's page, table, text and font kit, as the shot sheet uses it: see the
// note at the top of lib/ensemble/render/pdf/shotSheet.ts.
import { PDFDocument, type PDFFont } from "pdf-lib";
import { embedFamily } from "@/lib/pdf/embedFonts";
import type { FontSource } from "@/lib/pdf/fontSource";
import { addSheet, hexColour, type Colour, type Sheet } from "@/lib/pdf/page";
import { paginate } from "@/lib/pdf/table";
import { wrap } from "@/lib/pdf/text";
import { contentBox, PAGE_SIZES, ptToMm } from "@/lib/pdf/units";
import type { ProcessionalRow } from "../../rows";

interface ProcessionalSheetOptions {
  fontSource: FontSource;
  /** "Alex & Sam", or nothing yet. */
  coupleNames: string;
  generatedOn?: string;
}

const MARGIN_MM = 15;
const HEADER_MM = 16;
const FOOTER_MM = 10;
const ACCENT = "#46617a";
const BODY_PT = 9.5;
const LEADING = 1.35;
const NO_COL_MM = 10;
const HOW_COL_MM = 42;
const MUSIC_COL_MM = 58;

const MUTED: Colour = { r: 0.44, g: 0.43, b: 0.41 };
const RULE: Colour = { r: 0.84, g: 0.83, b: 0.82 };
const DANGER: Colour = { r: 0.64, g: 0.23, b: 0.17 };

interface Line {
  row: ProcessionalRow;
  labelLines: string[];
  peopleLines: string[];
  howLines: string[];
  musicLines: string[];
  cueLines: string[];
  heightMm: number;
}

/**
 * The processional on paper, for the officiant and whoever runs the day: who
 * walks, in order, how, and what the music is doing. A mark in the margin
 * where a group names somebody not set, as the screen does.
 */
export async function renderProcessionalSheet(rows: ProcessionalRow[], options: ProcessionalSheetOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFamily(pdf, await options.fontSource("Lato"));
  const accent = hexColour(ACCENT);
  const size = PAGE_SIZES.A4;
  const box = contentBox(size, MARGIN_MM);
  const whoColMm = box.widthMm - NO_COL_MM - HOW_COL_MM - MUSIC_COL_MM - 8;
  const lineMm = ptToMm(BODY_PT * LEADING);

  const lines: Line[] = rows.map((row) => {
    const labelLines = wrap(row.label, bold, BODY_PT, whoColMm);
    const peopleLines = row.people.length > 0 ? wrap(row.people.join(", "), regular, BODY_PT, whoColMm) : [];
    const howLines = wrap(row.how, regular, BODY_PT, HOW_COL_MM);
    const musicLines = row.music ? wrap(row.music, bold, BODY_PT, MUSIC_COL_MM) : [];
    const cueLines = row.cue ? wrap(row.cue, regular, BODY_PT, MUSIC_COL_MM) : [];
    const tall = Math.max(labelLines.length + peopleLines.length, howLines.length, musicLines.length + cueLines.length, 1);
    return { row, labelLines, peopleLines, howLines, musicLines, cueLines, heightMm: tall * lineMm + 3 };
  });

  const pages = paginate(lines, box.heightMm - HEADER_MM - FOOTER_MM);
  pages.forEach((indices, pageIndex) => {
    const sheet = addSheet(pdf, size);
    const y0 = box.yMm;
    const title = options.coupleNames ? `The processional — ${options.coupleNames}` : "The processional";
    sheet.text(title, { xMm: box.xMm, yMm: y0 + 6, font: bold, sizePt: 14 });
    sheet.text(`Page ${pageIndex + 1} of ${pages.length}`, {
      xMm: box.xMm + box.widthMm,
      yMm: y0 + 6,
      font: regular,
      sizePt: 8,
      colour: MUTED,
      alignRight: true,
    });
    sheet.line(box.xMm, y0 + 9, box.xMm + box.widthMm, y0 + 9, { widthPt: 1, colour: accent });

    let y = y0 + HEADER_MM;
    for (const index of indices) {
      const line = lines[index];
      if (line) y = drawLine(sheet, line, { xMm: box.xMm, widthMm: box.widthMm, whoColMm, lineMm, y, bold, regular });
    }

    sheet.text(options.generatedOn ?? "", { xMm: box.xMm, yMm: size.heightMm - MARGIN_MM + 4, font: regular, sizePt: 8, colour: MUTED });
  });

  return pdf.save();
}

function drawLine(
  sheet: Sheet,
  line: Line,
  at: { xMm: number; widthMm: number; whoColMm: number; lineMm: number; y: number; bold: PDFFont; regular: PDFFont },
): number {
  const whoX = at.xMm + NO_COL_MM;
  const howX = whoX + at.whoColMm + 4;
  const musicX = howX + HOW_COL_MM + 4;
  const draw = (texts: string[], xMm: number, font: PDFFont, from = 0) =>
    texts.forEach((text, i) => {
      if (text) sheet.text(text, { xMm, yMm: at.y + at.lineMm * (from + i + 1), font, sizePt: BODY_PT });
    });

  sheet.text(`${line.row.number}.`, { xMm: at.xMm, yMm: at.y + at.lineMm, font: at.regular, sizePt: BODY_PT });
  draw(line.labelLines, whoX, at.bold);
  draw(line.peopleLines, whoX, at.regular, line.labelLines.length);
  draw(line.howLines, howX, at.regular);
  draw(line.musicLines, musicX, at.bold);
  draw(line.cueLines, musicX, at.regular, line.musicLines.length);

  if (line.row.trouble) sheet.rect(at.xMm - 3.5, at.y + 1.2, 1.4, at.lineMm * 0.8, { colour: DANGER });

  const bottom = at.y + line.heightMm;
  sheet.line(at.xMm, bottom - 1, at.xMm + at.widthMm, bottom - 1, { widthPt: 0.5, colour: RULE });
  return bottom;
}
