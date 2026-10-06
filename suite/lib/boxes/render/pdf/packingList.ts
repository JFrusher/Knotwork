// Brigade's page, table, text and font kit, as the shot sheet uses it: see the
// note at the top of lib/ensemble/render/pdf/shotSheet.ts.
import { PDFDocument } from "pdf-lib";
import { embedFamily } from "@/lib/pdf/embedFonts";
import type { FontSource } from "@/lib/pdf/fontSource";
import { addSheet, hexColour, type Colour } from "@/lib/pdf/page";
import { paginate } from "@/lib/pdf/table";
import { wrap } from "@/lib/pdf/text";
import { contentBox, PAGE_SIZES, ptToMm } from "@/lib/pdf/units";
import { itemText, type BoxRow } from "../../rows";

interface PackingListOptions {
  fontSource: FontSource;
  coupleNames: string;
  generatedOn?: string;
}

const MARGIN_MM = 15;
const HEADER_MM = 16;
const FOOTER_MM = 10;
const ACCENT = "#46617a";
const BODY_PT = 9.5;
const LEADING = 1.35;
const TICK_MM = 3.2;
const MUTED: Colour = { r: 0.44, g: 0.43, b: 0.41 };
const DANGER: Colour = { r: 0.64, g: 0.23, b: 0.17 };

type Line =
  | { kind: "box"; title: string; detail: string; lost: boolean; heightMm: number }
  | { kind: "item"; lines: string[]; packed: boolean; heightMm: number };

/**
 * Every box and every thing in it, with a box to tick — the ones already
 * packed ticked — for packing with a pen in hand rather than a phone.
 */
export async function renderPackingList(rows: BoxRow[], options: PackingListOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFamily(pdf, await options.fontSource("Lato"));
  const accent = hexColour(ACCENT);
  const size = PAGE_SIZES.A4;
  const box = contentBox(size, MARGIN_MM);
  const lineMm = ptToMm(BODY_PT * LEADING);
  const textX = box.xMm + TICK_MM + 3;

  const lines: Line[] = rows.flatMap((row): Line[] => [
    {
      kind: "box",
      title: `Box ${row.number} · ${row.name}`,
      detail: [row.where, row.takenBy.length > 0 ? `Taken by ${row.takenBy.join(", ")}` : ""].filter(Boolean).join(" · "),
      lost: row.lost,
      heightMm: ptToMm(11 * LEADING) + lineMm + 4,
    },
    ...row.items.map((item): Line => {
      const wrapped = wrap(itemText(item), regular, BODY_PT, box.widthMm - (textX - box.xMm));
      return { kind: "item", lines: wrapped, packed: item.packed, heightMm: wrapped.length * lineMm + 1.2 };
    }),
  ]);

  const pages = paginate(lines, box.heightMm - HEADER_MM - FOOTER_MM);
  pages.forEach((indices, pageIndex) => {
    const sheet = addSheet(pdf, size);
    const y0 = box.yMm;
    sheet.text(options.coupleNames ? `Packing list — ${options.coupleNames}` : "Packing list", { xMm: box.xMm, yMm: y0 + 6, font: bold, sizePt: 14 });
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
      if (!line) continue;
      if (line.kind === "box") {
        sheet.text(line.title, { xMm: box.xMm, yMm: y + ptToMm(11) + 2, font: bold, sizePt: 11 });
        sheet.text(line.detail, { xMm: box.xMm, yMm: y + ptToMm(11) + 2 + lineMm, font: regular, sizePt: BODY_PT, colour: line.lost ? DANGER : MUTED });
      } else {
        const top = y + lineMm - TICK_MM + 0.4;
        const [x0, x1, y1] = [box.xMm, box.xMm + TICK_MM, top + TICK_MM];
        sheet.line(x0, top, x1, top);
        sheet.line(x1, top, x1, y1);
        sheet.line(x1, y1, x0, y1);
        sheet.line(x0, y1, x0, top);
        if (line.packed) {
          sheet.line(x0 + 0.6, top + TICK_MM * 0.55, x0 + TICK_MM * 0.4, y1 - 0.6, { widthPt: 1 });
          sheet.line(x0 + TICK_MM * 0.4, y1 - 0.6, x1 - 0.5, top + 0.5, { widthPt: 1 });
        }
        line.lines.forEach((text, i) => sheet.text(text, { xMm: textX, yMm: y + lineMm * (i + 1), font: regular, sizePt: BODY_PT }));
      }
      y += line.heightMm;
    }

    sheet.text(options.generatedOn ?? "", { xMm: box.xMm, yMm: size.heightMm - MARGIN_MM + 4, font: regular, sizePt: 8, colour: MUTED });
  });

  return pdf.save();
}
