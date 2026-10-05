import type { Knotwork } from "@jfrusher/knotwork";
import { fromGallery, GALLERY } from "../core/data/gallery";
import { buildJob } from "../core/job";
import { makeResolveOptions } from "../core/template/resolve";
import type { CardSpec, SheetSpec, Template } from "../core/types";
import { initialDesign, type Suite } from "../state/design";
import { loadEveryFont } from "../state/fontLoader";
import { roomRows } from "../state/fromRoom";
import { loadImages, toSource } from "../state/imageStore";
import { roomScene } from "../state/roomScene";
import { readSuite } from "../state/sliceBridge";

/** A4, in PDF points. */
const A4 = { short: 595.28, long: 841.89 };

/**
 * The plan the wedding pack prints: the wedding's own floor plan — the first
 * piece that draws the whole room — as designed in Place cards. A wedding that
 * has not made one yet gets the floor plan design as it starts.
 */
export function packFloorPlan(suite: Suite, headers: string[]): { name: string; card: CardSpec; sheet: SheetSpec; template: Template } {
  const piece = suite.pieces.find((p) => p.template.elements.some((el) => el.kind === "room" && el.show === "room"));
  if (piece) return { name: piece.name, card: piece.card, sheet: piece.sheet, template: piece.template };
  const entry = GALLERY.find((g) => g.id === "floor-plan");
  if (!entry) throw new Error('The gallery has no "floor-plan" design.');
  const { card, sheet } = initialDesign();
  return { name: "Floor plan", ...fromGallery(entry, card, sheet, headers) };
}

/**
 * The room for the wedding pack, on A4: the floor plan through Place cards'
 * own pipeline — the same fonts, the same fitting — drawn on its own card
 * with no print-shop marks, then shrunk onto the binder's page.
 */
export async function packFloorPlanPdf(wedding: { raw: Record<string, unknown>; doc: Knotwork }): Promise<Uint8Array | null> {
  const scene = roomScene(wedding.doc);
  if (scene.tables.length === 0) return null;
  const { suite } = readSuite(wedding);
  const { headers, rows, rowIds } = roomRows(wedding.doc);
  const plan = packFloorPlan(suite, headers);

  const [{ fonts }, images, { renderPdf }] = await Promise.all([
    loadEveryFont(),
    loadImages(),
    import("../render/pdf/renderPdf"),
  ]);
  const job = buildJob({
    template: plan.template,
    card: plan.card,
    // The card alone: its own page, nothing round it to cut by.
    sheet: {
      ...plan.sheet,
      page: "FIT",
      marginTopMm: 0,
      marginRightMm: 0,
      marginBottomMm: 0,
      marginLeftMm: 0,
      cropMarks: false,
      cutLines: false,
      foldGuides: false,
      duplex: false,
      slugLine: false,
    },
    rows,
    headers,
    rowIds,
    resolve: makeResolveOptions(
      fonts,
      suite.uploadedIcons,
      new Map(images.map((i) => [i.id, toSource(i)])),
      suite.assetNames,
      scene,
    ),
  });
  const { bytes } = await renderPdf({ sheets: job.sheets, fonts, title: plan.name, scale: 1 });
  return onA4(bytes);
}

/** Each page shrunk to fit A4, turned the way it is, centred. */
async function onA4(bytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  out.setTitle(source.getTitle() ?? "Floor plan");
  const pages = await out.embedPages(source.getPages());
  for (const page of pages) {
    const landscape = page.width > page.height;
    const [w, h] = landscape ? [A4.long, A4.short] : [A4.short, A4.long];
    const k = Math.min(w / page.width, h / page.height);
    out.addPage([w, h]).drawPage(page, {
      x: (w - page.width * k) / 2,
      y: (h - page.height * k) / 2,
      width: page.width * k,
      height: page.height * k,
    });
  }
  return out.save();
}
