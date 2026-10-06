import { pageSizeMm } from "../units";
import type { CardSpec, PaperName, Point, Segment, Sheet, SheetSpec } from "../types";

/**
 * Two pages side by side on a landscape sheet, meeting at its middle where it
 * folds: no gap, no marks, centred. Refused when two do not fit the paper —
 * an A5 booklet needs A4, and Letter takes half-letter pages.
 */
export function bookletSheet(card: CardSpec, sheet: SheetSpec, paper: PaperName): SheetSpec {
  const page = pageSizeMm(paper, "landscape");
  const spareX = page.w - 2 * card.widthMm;
  const spareY = page.h - card.heightMm;
  if (spareX < -1e-6 || spareY < -1e-6) {
    throw new Error(`Two ${card.widthMm} × ${card.heightMm}mm pages do not fit side by side on ${paper}.`);
  }
  return {
    ...sheet,
    page: paper,
    orientation: "landscape",
    marginLeftMm: spareX / 2,
    marginRightMm: spareX / 2,
    marginTopMm: spareY / 2,
    marginBottomMm: spareY / 2,
    gapXMm: 0,
    gapYMm: 0,
    cardRotationDeg: 0,
    cropMarks: false,
    cutLines: false,
    foldGuides: false,
    duplex: false,
  };
}

/**
 * A sheet turned upside down: what the back of a booklet needs on a printer
 * that turns the paper over its long edge, which would otherwise print every
 * other side upside down.
 */
export function rotateSheet180(sheet: Sheet): Sheet {
  const W = sheet.pageWidthMm;
  const H = sheet.pageHeightMm;
  const point = (p: Point): Point => ({ x: W - p.x, y: H - p.y });
  const segment = (s: Segment): Segment => [point(s[0]), point(s[1])];
  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      origin: { x: W - card.origin.x - card.footprint.w, y: H - card.origin.y - card.footprint.h },
      scene: {
        ...card.scene,
        elements: card.scene.elements.map((el) => ({
          ...el,
          x: W - el.x - el.w,
          y: H - el.y - el.h,
          rotationDeg: (el.rotationDeg + 180) % 360,
        })),
      },
    })),
    guides: {
      cropMarks: sheet.guides.cropMarks.map(segment),
      cutLines: sheet.guides.cutLines.map(segment),
      foldGuides: sheet.guides.foldGuides.map(segment),
      bleedBoxes: sheet.guides.bleedBoxes.map((box) => ({ x: W - box.x - box.w, y: H - box.y - box.h, w: box.w, h: box.h })),
    },
  };
}
