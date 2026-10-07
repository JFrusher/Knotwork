// Brigade's page, text and font kit, as the packing list uses it: see the
// note at the top of lib/group-shots/render/pdf/shotSheet.ts.
import { PDFDocument } from "pdf-lib";
import { embedFamily } from "@/lib/pdf/embedFonts";
import type { FontSource } from "@/lib/pdf/fontSource";
import { addSheet, hexColour, type Colour } from "@/lib/pdf/page";
import { contentBox, PAGE_SIZES, ptToMm } from "@/lib/pdf/units";
import type { ShoppingGroup } from "../../rows";

interface ShoppingListOptions {
  fontSource: FontSource;
  coupleNames: string;
  /** "For 100 coming, and 30 in the evening". */
  forWhom: string;
  /** "About 1,206 for what has a price." */
  spend: string;
  generatedOn?: string;
}

const MARGIN_MM = 15;
const ACCENT = "#46617a";
const BODY_PT = 10;
const LEADING = 1.6;
const TICK_MM = 3.2;
const NAME_MM = 62;
const MUTED: Colour = { r: 0.44, g: 0.43, b: 0.41 };

/**
 * The drinks to buy, by where they are bought, with a box to tick for each —
 * one page, since there are never more than eight lines.
 */
export async function renderShoppingList(groups: ShoppingGroup[], options: ShoppingListOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFamily(pdf, await options.fontSource("Lato"));
  const size = PAGE_SIZES.A4;
  const box = contentBox(size, MARGIN_MM);
  const lineMm = ptToMm(BODY_PT * LEADING);
  const sheet = addSheet(pdf, size);
  const right = box.xMm + box.widthMm;
  const textX = box.xMm + TICK_MM + 3;

  const y0 = box.yMm;
  sheet.text(options.coupleNames ? `Drinks to buy — ${options.coupleNames}` : "Drinks to buy", { xMm: box.xMm, yMm: y0 + 6, font: bold, sizePt: 14 });
  sheet.line(box.xMm, y0 + 9, right, y0 + 9, { widthPt: 1, colour: hexColour(ACCENT) });
  sheet.text(options.forWhom, { xMm: box.xMm, yMm: y0 + 15, font: regular, sizePt: BODY_PT, colour: MUTED });

  let y = y0 + 24;
  for (const group of groups) {
    sheet.text(group.name, { xMm: box.xMm, yMm: y, font: bold, sizePt: 11 });
    y += lineMm + 1;
    for (const row of group.rows) {
      const top = y - TICK_MM + 0.4;
      const [x0, x1, y1] = [box.xMm, box.xMm + TICK_MM, top + TICK_MM];
      sheet.line(x0, top, x1, top);
      sheet.line(x1, top, x1, y1);
      sheet.line(x1, y1, x0, y1);
      sheet.line(x0, y1, x0, top);
      sheet.text(row.name, { xMm: textX, yMm: y, font: regular, sizePt: BODY_PT });
      sheet.text([row.amount, row.cases].filter(Boolean).join(" · "), { xMm: textX + NAME_MM, yMm: y, font: regular, sizePt: BODY_PT });
      if (row.cost !== null) sheet.text(row.cost.toFixed(2), { xMm: right, yMm: y, font: regular, sizePt: BODY_PT, alignRight: true });
      y += lineMm;
    }
    y += lineMm * 0.6;
  }

  sheet.text(options.spend, { xMm: box.xMm, yMm: y + 2, font: bold, sizePt: BODY_PT });
  sheet.text(options.generatedOn ?? "", { xMm: box.xMm, yMm: size.heightMm - MARGIN_MM + 4, font: regular, sizePt: 8, colour: MUTED });
  return pdf.save();
}
