import type { Mm, Orientation, PageSizeName, PaperName, Pt, Size } from "./types";

/** 1 inch = 25.4mm = 72 PostScript points. */
const PT_PER_MM = 72 / 25.4;

export function mmToPt(mm: Mm): Pt {
  return mm * PT_PER_MM;
}

export function ptToMm(pt: Pt): Mm {
  return pt / PT_PER_MM;
}

/** Portrait dimensions. Landscape is the swap, done by `pageSizeMm`. */
export const PAGE_SIZES_MM: Record<PaperName, Size> = {
  A4: { w: 210, h: 297 },
  LETTER: { w: 215.9, h: 279.4 },
  A3: { w: 297, h: 420 },
};

/**
 * The longest side of anything Stationery makes: A0, the largest sheet a print
 * shop commonly takes.
 */
export const LARGEST_CARD_MM = 1189;

/** The paper a home printer is fed for this sheet: the sheet's own, or what a print-shop page is tiled onto. */
export function homePaper(sheet: { page: PageSizeName; tilePaper: PaperName }): PaperName {
  return sheet.page === "FIT" ? sheet.tilePaper : sheet.page;
}

export function pageSizeMm(page: PaperName, orientation: Orientation): Size {
  const portrait = PAGE_SIZES_MM[page];
  return orientation === "portrait" ? { ...portrait } : { w: portrait.h, h: portrait.w };
}

/** Rounds to 0.01mm. Guards float dust from accumulating through transforms. */
export function roundMm(mm: Mm): Mm {
  return Math.round(mm * 100) / 100;
}
