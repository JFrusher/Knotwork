import type { Knotwork } from "@jfrusher/knotwork";
import { weddingGuestBlocks } from "@/lib/ceremony/guestCopy";
import { bookletRows } from "../core/data/booklet";
import { fromGallery, type GalleryTemplate } from "../core/data/gallery";
import { artefactsOf } from "../core/data/parts";
import { resolveCard } from "../core/template/bindings";
import { defaultCard, defaultSheet } from "../core/template/defaults";
import { makeResolveOptions } from "../core/template/resolve";
import type { LoadedFont } from "../core/text/measure";
import type { RoomScene, Sheet } from "../core/types";
import { bookletFacts, BOOKLET_COLUMNS } from "./fromCeremony";
import { roomRows } from "./fromRoom";

/**
 * What a gallery design would print first for this wedding — a booklet's
 * cover, a card for its first guest, a board of its room — as a one-card
 * sheet for the gallery to draw. The wedding's own names, so a couple choose
 * by how their own day looks in it.
 */
export function galleryPreview(entry: GalleryTemplate, doc: Knotwork, fonts: Map<string, LoadedFont>, room: RoomScene): Sheet {
  const room0 = roomRows(doc);
  const { rows, headers } = entry.booklet
    ? { rows: bookletRows(bookletFacts(doc), 1).rows, headers: [...BOOKLET_COLUMNS] }
    : { rows: room0.rows, headers: room0.headers };
  const { card, template } = fromGallery(entry, defaultCard(), defaultSheet(), headers);
  const first = artefactsOf(template, rows, headers)[0];
  const resolve = makeResolveOptions(fonts, {}, new Map(), {}, room, entry.booklet ? weddingGuestBlocks(doc) : null);
  const scene = first ? resolveCard(template, first.row, card, resolve, first.rows).scene : { elements: [], backgroundHex: template.backgroundHex };
  return {
    index: 0,
    pageWidthMm: card.widthMm,
    pageHeightMm: card.heightMm,
    cards: [{ origin: { x: 0, y: 0 }, footprint: { w: card.widthMm, h: card.heightMm }, artefactIndex: 0, scene }],
    guides: { cropMarks: [], cutLines: [], foldGuides: [], bleedBoxes: [] },
  };
}
