import { create } from "zustand";
import { DEFAULT_FONT_ID } from "../assets/fonts";
import type { RowIssue, GuestRow } from "../core/data/rows";
import { defaultFoldPosition } from "../core/geometry/fold";
import { sideOf } from "../core/imposition/duplex";
import type { LayoutSuggestion } from "../core/geometry/suggestLayouts";
import { newId } from "../core/template/defaults";
import {
  withOverride,
  withoutOverride,
  type ElementPatch,
} from "../core/template/overrides";
import { rebindTemplate } from "../core/template/rebind";
import { elementKind } from "../core/template/registry";
import { GALLERY, type GalleryTemplate } from "../core/data/gallery";

/**
 * The columns the shipped gallery is written against. Rebinding maps them onto
 * whatever the loaded CSV calls the same roles.
 */
const SAMPLE_HEADERS = ["First Name", "Last Name", "Table", "Dietary"];
import type {
  CardElement,
  CardSide,
  CardSpec,
  ElementId,
  Rect,
  ResolvedImageSource,
  RoomScene,
  RowScope,
  SheetSpec,
  Template,
} from "../core/types";
import type { LoadedFont } from "../core/text/measure";
import type { PrinterProfile } from "../core/print/printerProfile";
import type { Knotwork } from "@jfrusher/knotwork";
import { useKnotworkStore, type WriteOptions } from "@/lib/store/useKnotworkStore";
import { DESIGN_KEYS, designFor, designOf, initialSuite, newPiece, type Design, type Suite } from "./design";
import { readDesign, readSuite, writeDesign, writeSuite } from "./sliceBridge";
import { roomRows, withMerges, type Merged } from "./fromRoom";
import { roomScene } from "./roomScene";
import { printBasis, recordPrint } from "./printed";
import type { Artefact } from "../core/data/artefacts";
import { linkUrl, useGuestLink } from "@/lib/share/guestLink";

export interface PieceSummary {
  id: string;
  name: string;
}

/** Every kind the registry knows about — see core/template/registry. */
export type NewElementKind = CardElement["kind"];

/**
 * Place cards' state: the design, which is the wedding's stationery slice and
 * only ever shown here (see `design.ts`), and what belongs to this window.
 */
/**
 * What the open piece prints from: the room as it stands, with its combined
 * cards in place. Worked out, never stored — see `fromRoom`.
 */
export interface RoomData {
  headers: string[];
  rows: GuestRow[];
  /** A guest id, or a combined card's id, per row. */
  rowIds: string[];
  /** Said about the list as a whole, such as guests with no table yet. */
  rowIssues: RowIssue[];
  /** The seating plan, for a room element to draw. */
  room: RoomScene;
}

export interface PlaqueState extends Design, RoomData {
  /** Why the wedding's saved design could not be read, when it could not. */
  designProblem: string | null;

  /**
   * The piece on screen. This window's choice, not the wedding's: a partner
   * opening the seating board does not move anybody else off the place cards,
   * and undo never switches pieces.
   */
  pieceId: string;
  /** Every piece, in order, for the switcher. Same array until a name or the order changes. */
  pieces: PieceSummary[];

  /**
   * Artefact keys to export instead of all of them — a reprint of a few cards.
   * This window's, and cleared with the piece: a selection that outlived the
   * moment would quietly print a short run later.
   */
  printOnly: string[] | null;

  /**
   * Parsed faces, keyed by fontId — bundled and uploaded alike. Held in the
   * store rather than a context so every panel and both renderers read fonts
   * the same way. Never persisted: the binaries live in IndexedDB.
   */
  fonts: Map<string, LoadedFont>;
  fontLabels: Record<string, string>;

  /** Uploaded images, keyed by imageId. Binaries live in IndexedDB. */
  images: Map<string, ResolvedImageSource>;
  imageNames: Record<string, string>;

  /** Which loaded faces were uploaded, rather than bundled. */
  uploadedFontIds: string[];

  /**
   * Per-device printer calibration (S-D2.1). Kept in the store so the export bar
   * and the print setup panel cannot disagree about which factor applies.
   * Persisted to IndexedDB by printerStore, never into a project file.
   */
  printers: PrinterProfile[];
  activePrinterId: string | null;

  // UI
  /**
   * Which side of the card the editor is showing. New elements are stamped with
   * it, so the two sides come out of one element list — see core/imposition/duplex.
   */
  editingSide: CardSide;
  selectedId: ElementId | null;
  /**
   * The image element whose crop is being dragged on the canvas, if any.
   * Transient by design: it is a pointer mode, not part of the design, so it is
   * neither persisted nor snapshotted for undo.
   */
  cropId: ElementId | null;
  page: number;
  previewGuestIndex: number;

  switchPiece: (id: string) => void;
  /**
   * Opens the piece with this id, making it from the gallery design of the
   * same id first if the wedding has none: how Seating's Print sends someone
   * to "the floor plan" whether or not it exists yet.
   */
  openPiece: (id: string) => void;
  /** A new, empty piece, opened. */
  addPiece: (name: string) => void;
  /** A copy of a piece — design and data — opened. */
  duplicatePiece: (id: string) => void;
  renamePiece: (id: string, name: string) => void;
  /** The last piece cannot be removed: a wedding's stationery always has one. */
  removePiece: (id: string) => void;

  setPrintOnly: (keys: string[] | null) => void;
  /** These artefacts have gone to the printer: the record changes since are measured from. */
  notePrinted: (artefacts: Artefact[], partial: boolean) => void;
  setCard: (patch: Partial<CardSpec>) => void;
  setSheet: (patch: Partial<SheetSpec>) => void;
  applySuggestion: (s: LayoutSuggestion) => void;
  setBackground: (hex: string | null) => void;
  /** Changing scope changes how many artefacts exist, so pagination resets. */
  setRowScope: (scope: RowScope) => void;
  /** Applies a gallery design over the current data, rebinding its tokens (F2). */
  applyGalleryTemplate: (entry: GalleryTemplate) => void;

  /** S-I.3 — two guests on one card. Reversible by `splitRow`. */
  combineRows: (indexes: number[]) => void;
  splitRow: (rowId: string) => void;
  /** Design patch for one row only (D1). Passing `null` clears it. */
  overrideForRow: (rowId: string, elementId: ElementId, patch: ElementPatch | null) => void;

  addElement: (kind: NewElementKind) => void;
  updateElement: (id: ElementId, patch: Partial<CardElement>) => void;
  /**
   * Live drag updates, every frame. They share one label, and the wedding's
   * history keeps a run of writes under one label as one step — one drag is
   * one undo, not sixty.
   */
  setElementBox: (id: ElementId, box: Rect) => void;
  /** Pans or zooms the artwork inside an image element: one gesture, one undo, as a drag. */
  setElementCrop: (id: ElementId, patch: { zoom?: number; focusX?: number; focusY?: number }) => void;
  removeElement: (id: ElementId) => void;
  duplicateElement: (id: ElementId) => void;
  /** Replaces the back with a copy of the front, for cards read from either side. */
  copyFrontToBack: () => void;
  raiseElement: (id: ElementId) => void;
  lowerElement: (id: ElementId) => void;

  setImages: (images: Map<string, ResolvedImageSource>, names: Record<string, string>) => void;
  addImage: (source: ResolvedImageSource, name: string) => void;
  removeImage: (id: string) => void;

  setFonts: (fonts: Map<string, LoadedFont>, labels: Record<string, string>, uploadedFontIds: string[]) => void;
  addFont: (font: LoadedFont, label: string, fileName?: string) => void;
  removeFont: (id: string) => void;
  /** Records what an asset id was called, even when the asset itself failed to load. */
  noteAssetName: (id: string, name: string) => void;
  addUploadedIcon: (id: string, pathD: string) => void;
  removeUploadedIcon: (id: string) => void;

  setPrinters: (printers: PrinterProfile[], activeId: string | null) => void;
  /** Adds or replaces one profile by id, and makes it the active printer. */
  upsertPrinter: (profile: PrinterProfile) => void;
  removePrinter: (id: string) => void;
  setActivePrinter: (id: string | null) => void;

  setEditingSide: (side: CardSide) => void;
  select: (id: ElementId | null) => void;
  /** Enters or leaves crop mode. Leaving is `null`. */
  setCropId: (id: ElementId | null) => void;
  setPage: (page: number) => void;
  setPreviewGuestIndex: (index: number) => void;
  toggleSnap: () => void;
  toggleSheetCollapsed: () => void;

  clearAll: () => void;
}

type Wedding = { raw: Record<string, unknown>; doc: Knotwork };

/** The last room read, so a design edit does not rebuild every row. */
let lastLive: { inputs: unknown[]; data: RoomData } | null = null;

/** The open piece's rows: the room, with its combined cards in place, and the guest link. */
function live(wedding: Wedding, merged: Merged): RoomData {
  const link = guestLinkUrl();
  const inputs = [wedding.raw["guests"], wedding.raw["seating"], wedding.raw["event"], merged, link];
  if (lastLive && inputs.every((input, i) => input === lastLive!.inputs[i])) return lastLive.data;
  const room = roomRows(wedding.doc);
  const merges = withMerges(room, merged);
  const data = {
    headers: room.headers,
    rowIds: merges.rowIds,
    rows: link ? merges.rows.map((row) => ({ ...row, "Guest Link": link })) : merges.rows,
    rowIssues: room.issues,
    room: roomScene(wedding.doc),
  };
  lastLive = { inputs, data };
  return data;
}

export const usePlaque = create<PlaqueState>()((set, get) => {
  /**
   * A change to the design goes into the wedding, which is what this store
   * then shows (see the subscription below); the rest of it — a selection, a
   * page — is this window's own.
   */
  const change = (options: WriteOptions, mutate: (s: PlaqueState) => Partial<PlaqueState>) => {
    const s = get();
    const next = mutate(s);
    const design: Partial<Record<keyof Design, unknown>> = {};
    const local: Partial<Record<keyof PlaqueState, unknown>> = {};
    for (const [key, value] of Object.entries(next)) {
      if ((DESIGN_KEYS as readonly string[]).includes(key)) design[key as keyof Design] = value;
      else local[key as keyof PlaqueState] = value;
    }
    if (Object.keys(design).length > 0) {
      writeDesign({ ...designOf(s), ...(design as Partial<Design>) }, s.pieceId, options);
    }
    if (Object.keys(local).length > 0) set(local as Partial<PlaqueState>);
  };
  /** An edit: shown as "Undo <label>". */
  const commit = (label: string, mutate: (s: PlaqueState) => Partial<PlaqueState>) => change({ label }, mutate);
  /** Bookkeeping nobody would undo: which asset had which name, which pane is open. */
  const note = (mutate: (s: PlaqueState) => Partial<PlaqueState>) => change({ silent: true }, mutate);

  const replaceElement = (s: PlaqueState, id: ElementId, patch: Partial<CardElement>): Template => ({
    ...s.template,
    elements: s.template.elements.map((el) =>
      el.id === id ? ({ ...el, ...patch } as CardElement) : el,
    ),
  });

  /** A change to the suite itself — its pieces — rather than to the piece on screen. */
  const changeSuite = (label: string, mutate: (suite: Suite) => Suite) =>
    writeSuite(mutate(readSuite(useKnotworkStore.getState()).suite), { label });

  /** Shows piece `id`, starting it from its first card and the front. */
  const open = (suite: Suite, id: string) => {
    const design = designFor(suite, id);
    set({
      ...design,
      ...live(useKnotworkStore.getState(), design.merged),
      pieceId: id,
      printOnly: null,
      pieces: summarise(suite, get().pieces),
      editingSide: "front",
      selectedId: null,
      cropId: null,
      page: 0,
      previewGuestIndex: 0,
    });
  };

  const opened = readDesign(useKnotworkStore.getState(), null);
  return {
    ...opened.design,
    ...live(useKnotworkStore.getState(), opened.design.merged),
    printOnly: null,
    designProblem: opened.problem,
    pieceId: opened.pieceId,
    pieces: summarise(opened.suite, []),
    fonts: new Map(),
    fontLabels: {},
    images: new Map(),
    imageNames: {},
    uploadedFontIds: [],
    printers: [],
    activePrinterId: null,
    editingSide: "front",
    selectedId: null,
    cropId: null,
    page: 0,
    previewGuestIndex: 0,

    switchPiece: (id) => open(readSuite(useKnotworkStore.getState()).suite, id),

    openPiece: (id) => {
      const { suite } = readSuite(useKnotworkStore.getState());
      if (suite.pieces.some((p) => p.id === id)) return open(suite, id);
      const entry = GALLERY.find((g) => g.id === id);
      if (!entry) throw new Error(`No piece or design called "${id}".`);
      // "Floor plan — the room to scale, A1" is called "Floor plan".
      const name = entry.name.split(" — ")[0]!;
      changeSuite(`adding ${name}`, (current) => ({ ...current, pieces: [...current.pieces, newPiece(id, name)] }));
      open(readSuite(useKnotworkStore.getState()).suite, id);
      get().applyGalleryTemplate(entry);
    },

    addPiece: (name) => {
      const piece = newPiece(newId(), name);
      changeSuite(`adding ${name}`, (suite) => ({ ...suite, pieces: [...suite.pieces, piece] }));
      open(readSuite(useKnotworkStore.getState()).suite, piece.id);
    },

    duplicatePiece: (id) => {
      const copyId = newId();
      changeSuite("copying a piece", (suite) => {
        const at = suite.pieces.findIndex((p) => p.id === id);
        const source = suite.pieces[at];
        if (!source) throw new Error(`No piece "${id}" in the stationery.`);
        const copy = { ...source, id: copyId, name: `${source.name} (copy)` };
        return { ...suite, pieces: [...suite.pieces.slice(0, at + 1), copy, ...suite.pieces.slice(at + 1)] };
      });
      open(readSuite(useKnotworkStore.getState()).suite, copyId);
    },

    renamePiece: (id, name) =>
      changeSuite("a piece's name", (suite) => ({
        ...suite,
        pieces: suite.pieces.map((p) => (p.id === id ? { ...p, name } : p)),
      })),

    removePiece: (id) => {
      const { suite } = readSuite(useKnotworkStore.getState());
      if (suite.pieces.length <= 1) throw new Error("The last piece cannot be removed.");
      const removed = suite.pieces.find((p) => p.id === id);
      if (!removed) throw new Error(`No piece "${id}" in the stationery.`);
      // The one on screen goes: show its neighbour rather than jumping to the start.
      const at = suite.pieces.indexOf(removed);
      const next = suite.pieces[at + 1] ?? suite.pieces[at - 1]!;
      if (get().pieceId === id) set({ pieceId: next.id });
      changeSuite(`removing ${removed.name}`, (current) => ({
        ...current,
        pieces: current.pieces.filter((p) => p.id !== id),
      }));
    },

    setPrintOnly: (printOnly) => set({ printOnly }),

    // Bookkeeping, not an edit: nobody undoes having printed something.
    notePrinted: (artefacts, partial) =>
      note((s) => ({
        printed: recordPrint(s.printed, artefacts, partial, new Date().toISOString(), printBasis(s.template, s.room)),
      })),

    setCard: (patch) =>
      commit("the card", (s) => {
        const card = { ...s.card, ...patch };
        // Changing the fold axis makes the old fold position meaningless.
        if (patch.fold && patch.fold !== s.card.fold) {
          card.foldPositionMm = defaultFoldPosition(card);
        }
        return { card };
      }),

    setSheet: (patch) => commit("the sheet", (s) => ({ sheet: { ...s.sheet, ...patch }, page: 0 })),

    applySuggestion: (suggestion) =>
      commit("a sheet layout", (s) => ({ sheet: { ...s.sheet, ...suggestion.patch }, page: 0 })),

    setBackground: (hex) => commit("the background", (s) => ({ template: { ...s.template, backgroundHex: hex } })),

    applyGalleryTemplate: (entry) =>
      commit("a gallery design", (s) => ({
        card: { ...s.card, ...entry.card },
        sheet: { ...s.sheet, ...entry.sheet },
        // The gallery is written against the sample column names; rebinding
        // re-attaches it to whatever this CSV calls them (S-B.1).
        template: rebindTemplate(
          { ...entry.template, overrides: {} },
          SAMPLE_HEADERS,
          s.headers,
        ).template,
        selectedId: null,
        page: 0,
        previewGuestIndex: 0,
      })),

    setRowScope: (rowScope) =>
      commit("what each card is for", (s) => ({
        template: { ...s.template, rowScope },
        page: 0,
        previewGuestIndex: 0,
      })),

    // Combine and split change who shares a card, which is all of the guest
    // list a piece keeps. Undo takes either back, on the wedding's history.
    combineRows: (indexes) =>
      commit("combining guests", (s) => {
        const picked = [...new Set(indexes)].map((i) => s.rowIds[i]).filter((id): id is string => Boolean(id));
        if (picked.length < 2) return {};
        // A combined card picked again is opened up into its people: three
        // on one card is one card, not a card inside a card.
        const merged: Merged = { ...s.merged };
        const members = picked.flatMap((id) => {
          const inside = merged[id];
          delete merged[id];
          return inside ?? [id];
        });
        merged[`merged:${newId()}`] = members;
        return { merged, previewGuestIndex: 0, page: 0 };
      }),

    splitRow: (rowId) =>
      commit("splitting guests", (s) => {
        if (!s.merged[rowId]) return {};
        const { [rowId]: _dropped, ...merged } = s.merged;
        return { merged, previewGuestIndex: 0, page: 0 };
      }),

    overrideForRow: (rowId, elementId, patch) =>
      commit("one guest's card", (s) => ({
        template: {
          ...s.template,
          overrides: patch
            ? withOverride(s.template.overrides, rowId, elementId, patch)
            : withoutOverride(s.template.overrides, rowId, elementId),
        },
      })),

    addElement: (kind) =>
      commit("adding to the card", (s) => {
        const el = { ...makeElement(kind, s.card, s.headers, nextZ(s.template)), side: s.editingSide };
        return {
          template: { ...s.template, elements: [...s.template.elements, el] },
          selectedId: el.id,
        };
      }),

    updateElement: (id, patch) => commit("changing the card", (s) => ({ template: replaceElement(s, id, patch) })),

    setElementBox: (id, box) =>
      commit("moving on the card", (s) => ({
        template: {
          ...s.template,
          elements: s.template.elements.map((el) =>
            el.id === id ? { ...el, x: box.x, y: box.y, w: box.w, h: box.h } : el,
          ),
        },
      })),

    setElementCrop: (id, patch) =>
      commit("cropping an image", (s) => ({ template: replaceElement(s, id, patch as Partial<CardElement>) })),

    removeElement: (id) =>
      commit("removing from the card", (s) => ({
        template: { ...s.template, elements: s.template.elements.filter((el) => el.id !== id) },
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),

    duplicateElement: (id) =>
      commit("duplicating on the card", (s) => {
        const source = s.template.elements.find((el) => el.id === id);
        if (!source) return {};
        const copy = { ...source, id: newId(), x: source.x + 3, y: source.y + 3, z: nextZ(s.template) };
        return {
          template: { ...s.template, elements: [...s.template.elements, copy] },
          selectedId: copy.id,
        };
      }),

    /**
     * A flat place card that has to be readable from both seats: the back is
     * the same design, not a mirror of it.
     *
     * Card-relative coordinates are copied verbatim on purpose. The back sheet
     * is mirrored by SLOT in core/imposition/duplex, so a back element at the
     * same card coordinates lands exactly behind its front twin — and then
     * takes the printer's registration correction with it.
     *
     * One-shot, and re-runnable: the back is replaced outright, so changing the
     * front and pressing again re-syncs it. Per-row overrides are copied across
     * to the new ids, or the back would print the raw CSV value where the front
     * prints an edited one.
     */
    copyFrontToBack: () =>
      commit("copying the front to the back", (s) => {
        const fronts = s.template.elements.filter((el) => sideOf(el) === "front");
        if (fronts.length === 0) return {};

        const copyIdFor = new Map(fronts.map((el) => [el.id, newId()]));
        const backs = fronts.map((el) => ({ ...el, id: copyIdFor.get(el.id)!, side: "back" as const }));

        const overrides = Object.fromEntries(
          Object.entries(s.template.overrides ?? {}).map(([rowId, byElement]) => [
            rowId,
            // Only front ids survive, so this also sweeps up patches left behind
            // by the back elements this replaces.
            Object.fromEntries(
              Object.entries(byElement).flatMap(([elementId, patch]) => {
                const copyId = copyIdFor.get(elementId);
                return copyId ? [[elementId, patch], [copyId, patch]] : [];
              }),
            ),
          ]),
        );

        return {
          template: { ...s.template, elements: [...fronts, ...backs], overrides },
          // The copy is pointless unless the sheet actually prints two sides.
          sheet: { ...s.sheet, duplex: true },
          editingSide: "back",
          selectedId: null,
        };
      }),

    raiseElement: (id) =>
      commit("the stacking order", (s) => ({ template: replaceElement(s, id, { z: nextZ(s.template) }) })),

    lowerElement: (id) =>
      commit("the stacking order", (s) => ({
        template: replaceElement(s, id, {
          z: Math.min(0, ...s.template.elements.map((el) => el.z)) - 1,
        }),
      })),

    setImages: (images, imageNames) =>
      set((s) => {
        // Every object URL that is not carried over leaks its blob otherwise,
        // and in development React runs the loading effect twice.
        for (const [id, source] of s.images) {
          if (images.get(id) !== source) URL.revokeObjectURL(source.url);
        }
        return { images, imageNames };
      }),

    addImage: (source, name) =>
      note((s) => ({
        images: new Map(s.images).set(source.id, source),
        imageNames: { ...s.imageNames, [source.id]: name },
        assetNames: { ...s.assetNames, [source.id]: name },
      })),

    removeImage: (id) =>
      commit("removing an image", (s) => {
        const images = new Map(s.images);
        const dropped = images.get(id);
        if (dropped) URL.revokeObjectURL(dropped.url);
        images.delete(id);
        const { [id]: _dropped, ...imageNames } = s.imageNames;
        // Deliberate removal is not a missing asset: forget the name too, and
        // the elements below stop pointing at it.
        const { [id]: _droppedName, ...assetNames } = s.assetNames;
        // Elements pointing at it fall back to empty rather than to a stale id.
        return {
          images,
          imageNames,
          assetNames,
          template: {
            ...s.template,
            elements: s.template.elements.map((el) =>
              el.kind === "image" && el.imageId === id ? { ...el, imageId: null } : el,
            ),
          },
        };
      }),

    setFonts: (fonts, fontLabels, uploadedFontIds) => set({ fonts, fontLabels, uploadedFontIds }),

    addFont: (font, label, fileName) =>
      note((s) => ({
        fonts: new Map(s.fonts).set(font.id, font),
        fontLabels: { ...s.fontLabels, [font.id]: label },
        assetNames: { ...s.assetNames, [font.id]: fileName ?? label },
        uploadedFontIds: s.uploadedFontIds.includes(font.id)
          ? s.uploadedFontIds
          : [...s.uploadedFontIds, font.id],
      })),

    removeFont: (id) =>
      commit("removing a font", (s) => {
        const fonts = new Map(s.fonts);
        fonts.delete(id);
        const { [id]: _dropped, ...fontLabels } = s.fontLabels;
        const { [id]: _droppedName, ...assetNames } = s.assetNames;
        // Any element still pointing at the removed face falls back to a
        // bundled one, so nothing silently renders as nothing.
        return {
          fonts,
          fontLabels,
          assetNames,
          uploadedFontIds: s.uploadedFontIds.filter((existing) => existing !== id),
          template: {
            ...s.template,
            elements: s.template.elements.map((el) => {
              if (el.kind === "grid") {
                return {
                  ...el,
                  fontId: el.fontId === id ? DEFAULT_FONT_ID : el.fontId,
                  headingFontId: el.headingFontId === id ? DEFAULT_FONT_ID : el.headingFontId,
                };
              }
              return (el.kind === "text" || el.kind === "list" || el.kind === "room") && el.fontId === id
                ? { ...el, fontId: DEFAULT_FONT_ID }
                : el;
            }),
          },
        };
      }),

    noteAssetName: (id, name) => note((s) => ({ assetNames: { ...s.assetNames, [id]: name } })),

    addUploadedIcon: (id, pathD) =>
      note((s) => ({ uploadedIcons: { ...s.uploadedIcons, [id]: pathD } })),

    removeUploadedIcon: (id) =>
      commit("removing an icon", (s) => {
        const { [id]: _dropped, ...uploadedIcons } = s.uploadedIcons;
        return { uploadedIcons };
      }),

    // Switching sides clears the selection: the selected element is no longer on
    // screen, and leaving it selected makes the inspector edit an invisible box.
    setEditingSide: (editingSide) => set({ editingSide, selectedId: null }),

    setPrinters: (printers, activePrinterId) => set({ printers, activePrinterId }),

    upsertPrinter: (profile) =>
      set((s) => ({
        printers: s.printers.some((p) => p.id === profile.id)
          ? s.printers.map((p) => (p.id === profile.id ? profile : p))
          : [...s.printers, profile],
        activePrinterId: profile.id,
      })),

    removePrinter: (id) =>
      set((s) => ({
        printers: s.printers.filter((p) => p.id !== id),
        activePrinterId: s.activePrinterId === id ? null : s.activePrinterId,
      })),

    setActivePrinter: (activePrinterId) => set({ activePrinterId }),

    // Selecting something else leaves crop mode: a crop drag belongs to the
    // element that was being cropped, and nothing else.
    select: (selectedId) => set((s) => ({ selectedId, cropId: s.cropId === selectedId ? s.cropId : null })),
    setCropId: (cropId) => set({ cropId }),
    setPage: (page) => set({ page }),
    setPreviewGuestIndex: (previewGuestIndex) => set({ previewGuestIndex }),
    toggleSnap: () => note((s) => ({ snapEnabled: !s.snapEnabled })),
    toggleSheetCollapsed: () => note((s) => ({ sheetCollapsed: !s.sheetCollapsed })),

    clearAll: () => {
      const suite = initialSuite();
      writeSuite(suite, { label: "clearing the cards" });
      // Bundled faces stay loaded; only uploaded ones are the user's data,
      // and those are removed from the map by the caller after clearing IDB.
      set({ uploadedFontIds: [] });
      open(suite, suite.pieces[0]!.id);
    },
  };
});

/**
 * The design is whatever the wedding's stationery slice holds — edited here,
 * put back by the header's undo, brought in from the library or from a
 * partner's device alike. Followed as it changes, synchronously, so there is
 * never a moment the two disagree.
 */
function follow(wedding: Wedding): void {
  const { design, problem, pieceId, suite } = readDesign(wedding, usePlaque.getState().pieceId);
  const present = (id: ElementId | null) => id !== null && design.template.elements.some((el) => el.id === id);
  usePlaque.setState((s) => ({
    ...design,
    ...live(wedding, design.merged),
    designProblem: problem,
    pieceId,
    // Another piece now: its cards are not the ones that were picked.
    printOnly: pieceId === s.pieceId ? s.printOnly : null,
    pieces: summarise(suite, s.pieces),
    // Something undone, or removed elsewhere, is no longer there to select.
    selectedId: present(s.selectedId) ? s.selectedId : null,
    cropId: present(s.cropId) ? s.cropId : null,
  }));
}

/**
 * The cards follow the room: a guest seated next door, a name corrected on the
 * guest list or a partner's name changed is on the card the moment it is made.
 * Only the slices a card reads are watched, so an edit to the timeline costs
 * Place cards nothing.
 */
useKnotworkStore.subscribe((state, prev) => {
  const watched = ["stationery", "guests", "seating", "event"] as const;
  if (watched.some((slice) => state.raw[slice] !== prev.raw[slice])) follow(state);
});

// A guest link published, or taken down, is on the cards at once.
useGuestLink.subscribe((state, prev) => {
  if (state.link !== prev.link) follow(useKnotworkStore.getState());
});

/** The published guest link's address, or empty: what `{{Guest Link}}` says. */
function guestLinkUrl(): string {
  const { link } = useGuestLink.getState();
  return link && typeof window !== "undefined" ? linkUrl(link, window.location.origin) : "";
}

/** The switcher's list, reusing `previous` when nothing it shows has changed. */
function summarise(suite: Suite, previous: PieceSummary[]): PieceSummary[] {
  const same =
    previous.length === suite.pieces.length &&
    suite.pieces.every((p, i) => previous[i]!.id === p.id && previous[i]!.name === p.name);
  return same ? previous : suite.pieces.map(({ id, name }) => ({ id, name }));
}

function nextZ(template: Template): number {
  return Math.max(0, ...template.elements.map((el) => el.z)) + 1;
}

/** A new element lands in the middle of the card, sized for its kind. */
function makeElement(
  kind: NewElementKind,
  card: CardSpec,
  headers: string[],
  z: number,
): CardElement {
  const spec = elementKind(kind);
  if (!spec) throw new Error(`Unknown element kind: ${kind}`);
  return spec.create({ id: newId(), z, card, headers });
}
