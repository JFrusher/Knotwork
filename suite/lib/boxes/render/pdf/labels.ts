// Brigade's page, text and font kit, as the shot sheet uses it: see the note
// at the top of lib/ensemble/render/pdf/shotSheet.ts.
import { PDFDocument } from "pdf-lib";
import { embedFamily } from "@/apps/brigade/render/pdf/embedFonts";
import type { FontSource } from "@/apps/brigade/render/pdf/fontSource";
import { addSheet, type Colour } from "@/apps/brigade/render/pdf/page";
import { wrap } from "@/apps/brigade/render/pdf/text";
import { PAGE_SIZES, ptToMm } from "@/apps/brigade/render/pdf/units";
import { itemText, type BoxRow } from "../../rows";

export interface LabelOptions {
  fontSource: FontSource;
}

const LABEL = { widthMm: 105, heightMm: 148.5 };
const PAD_MM = 8;
const BODY_PT = 9.5;
const LEADING = 1.35;
const MUTED: Colour = { r: 0.44, g: 0.43, b: 0.41 };
const DANGER: Colour = { r: 0.64, g: 0.23, b: 0.17 };
const CUT: Colour = { r: 0.75, g: 0.74, b: 0.73 };

/**
 * A label for each box, four to an A4 sheet, cut along the dashed lines: the
 * number large enough to read across a room, the name, where it has to be and
 * by when, who is taking it, and what is in it — as much as fits, then how
 * many more.
 */
export async function renderBoxLabels(rows: BoxRow[], options: LabelOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFamily(pdf, await options.fontSource("Lato"));
  const lineMm = ptToMm(BODY_PT * LEADING);
  const widthMm = LABEL.widthMm - PAD_MM * 2;

  for (let start = 0; start < Math.max(rows.length, 1); start += 4) {
    const sheet = addSheet(pdf, PAGE_SIZES.A4);
    sheet.line(LABEL.widthMm, 0, LABEL.widthMm, PAGE_SIZES.A4.heightMm, { dashed: true, colour: CUT });
    sheet.line(0, LABEL.heightMm, PAGE_SIZES.A4.widthMm, LABEL.heightMm, { dashed: true, colour: CUT });

    rows.slice(start, start + 4).forEach((row, index) => {
      const x = (index % 2) * LABEL.widthMm + PAD_MM;
      const top = Math.floor(index / 2) * LABEL.heightMm + PAD_MM;
      const bottom = top + LABEL.heightMm - PAD_MM * 2;

      sheet.text(String(row.number), { xMm: x, yMm: top + ptToMm(48), font: bold, sizePt: 48 });
      let y = top + ptToMm(48) + 4;
      for (const line of wrap(row.name, bold, 14, widthMm)) {
        y += ptToMm(14 * LEADING);
        sheet.text(line, { xMm: x, yMm: y, font: bold, sizePt: 14 });
      }
      for (const line of wrap(row.where, regular, 11, widthMm)) {
        y += ptToMm(11 * LEADING);
        sheet.text(line, { xMm: x, yMm: y, font: regular, sizePt: 11, colour: row.lost ? DANGER : undefined });
      }
      if (row.takenBy.length > 0) {
        for (const line of wrap(`Taken by ${row.takenBy.join(", ")}`, regular, BODY_PT, widthMm)) {
          y += lineMm;
          sheet.text(line, { xMm: x, yMm: y, font: regular, sizePt: BODY_PT, colour: MUTED });
        }
      }
      y += 3;
      sheet.line(x, y, x + widthMm, y, { widthPt: 0.5, colour: CUT });

      // As much of what is in it as fits, then how many more.
      const lines = row.items.flatMap((item) => wrap(itemText(item), regular, BODY_PT, widthMm).map((text, i) => ({ text, first: i === 0 })));
      const room = Math.floor((bottom - y) / lineMm);
      const shown = lines.length > room ? lines.slice(0, Math.max(room - 1, 0)) : lines;
      for (const line of shown) {
        y += lineMm;
        sheet.text(line.text, { xMm: x, yMm: y, font: regular, sizePt: BODY_PT });
      }
      if (shown.length < lines.length) {
        const more = row.items.length - shown.filter((line) => line.first).length;
        y += lineMm;
        sheet.text(`and ${more} more`, { xMm: x, yMm: y, font: bold, sizePt: BODY_PT, colour: MUTED });
      }
    });
  }

  return pdf.save();
}
