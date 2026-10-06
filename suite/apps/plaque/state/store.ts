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
import { elementKind } from "../core/template/registry";
import { fromGallery, GALLERY, type GalleryTemplate } from "../core/data/gallery";

/**
 * The columns the shipped gallery is written against. Rebinding maps them onto
 * whatever the loaded CSV calls the same roles.
 */
import type {
  CardElement,
  CardSide,
  CardSpec,
  ElementId,
  Rect,
  ResolvedImageSource,
  RoomElement,
  RoomScene,
  RowScope,
  SheetSpec,
  Template,
  TextElement,
  Booklet,
  PageRole,
  ServiceBlock,
} from "../core/types";
import type { LoadedFont } from "../core/text/measure";
import type { PrinterProfile } from "../core/print/printerProfile";
import type { Knotwork } from "@jfrusher/knotwork";
import { useKnotworkStore, type WriteOptions } from "@/lib/store/useKnotworkStore";
import { DESIGN_KEYS, designFor, designOf, initialSuite, newPiece, withDesign, type Design, type Suite } from "./design";
import { readDesign, readSuite, writeDesign, writeSuite } from "./sliceBridge";
import { roomRows, withMerges, type Merged } from "./fromRoom";
import { roomScene } from "./roomScene";
import { bookletData } from "./fromCeremony";
import { PAGE_ROLE_COLUMN } from "../core/data/booklet";
import { recordPrint, type PrintBasis } from "./printed";
import { normalise, type Artefact } from "../core/data/artefacts";
import { artefactsOf } from "../core/data/parts";
import { makeResolveOptions } from "../core/template/resolve";
import { centredOn, chairCells, chairNameSize, placeChairs, planLayout, stampableChairs } from "../core/template/room";
import { chairToken } from "../core/template/chairs";
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
interface RoomData {
  headers: string[];
  rows: GuestRow[];
  /** A guest id, or a combined card's id, per row. */
  rowIds: string[];
  /** Said about the list as a whole, such as guests with no table yet. */
  rowIssues: RowIssue[];
  /** The seating plan, for a room element to draw. */
  room: RoomScene;
  /** A booklet's order of service, for its service element to set; null on cards. */
  service: ServiceBlock[] | null;
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
  /**
   * These artefacts of piece `pieceId` have gone to the printer: the record
   * changes since are measured from. Named, not assumed: a print can finish
   * after another piece is opened.
   */
  notePrinted: (pieceId: string, artefacts: Artefact[], partial: boolean, basis: PrintBasis) => void;
  /**
   * How the booklet on screen is printed. A print shop takes each page on its
   * own, with crop marks and bleed, which is the sheet this sets for it.
   */
  setBooklet: (booklet: Booklet) => void;
  setCard: (patch: Partial<CardSpec>) => void;
  setSheet: (patch: Partial<SheetSpec>) => void;
  applySuggestion: (s: LayoutSuggestion) => void;
  setBackground: (hex: string | null) => void;
  /** How this design names a guest by their chair. See core/template/chairs. */
  setChairName: (pattern: string) => void;
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
  /**
   * A text box at every chair a plan names, each bound to its chair: `follow`
   * keeps them at their chairs as the room moves (always so for a table's own
   * map); otherwise they stay where they are put. `only` stamps just those
   * chairs. The plan stops naming those chairs itself.
   */
  stampChairs: (roomId: ElementId, follow: boolean, only?: Array<{ table: string | null; seat: number }>) => void;
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

/** The last booklet read, so a design edit that moves nothing does not lay the service out again. */
let lastBooklet: { inputs: unknown[]; data: RoomData } | null = null;

/**
 * The open piece's rows. A booklet's are its pages, from the ceremony; a
 * card's are the room, with its combined cards in place, and the guest link.
 */
function live(wedding: Wedding, design: Pick<Design, "merged" | "template" | "booklet">, fonts: Map<string, LoadedFont>): RoomData {
  if (design.booklet) {
    const raw = wedding.raw;
    const inputs = [raw["ceremony"], raw["guests"], raw["seating"], raw["cast"], raw["event"], raw["timeline"], design.template, fonts];
    if (lastBooklet && inputs.every((input, i) => input === lastBooklet!.inputs[i])) return lastBooklet.data;
    const pages = bookletData(wedding.doc, design.template, fonts);
    const data = { ...pages, rowIssues: [], room: roomScene(wedding.doc) };
    lastBooklet = { inputs, data };
    return data;
  }
  const { merged } = design;
  const chairName = design.template.chairName;
  const link = guestLinkUrl();
  const inputs = [wedding.raw["guests"], wedding.raw["seating"], wedding.raw["event"], merged, link, chairName];
  if (lastLive && inputs.every((input, i) => input === lastLive!.inputs[i])) return lastLive.data;
  const room = roomRows(wedding.doc);
  const merges = withMerges(room, merged, { chairName });
  const data = {
    headers: room.headers,
    rowIds: merges.rowIds,
    rows: link ? merges.rows.map((row) => ({ ...row, "Guest Link": link })) : merges.rows,
    rowIssues: room.issues,
    room: roomScene(wedding.doc),
    service: null,
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
      ...live(useKnotworkStore.getState(), design, get().fonts),
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
    ...live(useKnotworkStore.getState(), opened.design, new Map()),
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
      // Made with its design in one step, so one undo takes the whole piece back.
      const fresh = newPiece(id, name);
      const piece = { ...fresh, ...fromGallery(entry, fresh.card, fresh.sheet, get().headers) };
      changeSuite(`adding ${name}`, (current) => ({ ...current, pieces: [...current.pieces, piece] }));
      open(readSuite(useKnotworkStore.getState()).suite, id);
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
        // A copy has not been printed: nothing on paper is out of date.
        const copy = { ...source, id: copyId, name: `${source.name} (copy)`, printed: null };
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
      const wasOpen = get().pieceId === id;
      changeSuite(`removing ${removed.name}`, (current) => ({
        ...current,
        pieces: current.pieces.filter((p) => p.id !== id),
      }));
      if (wasOpen) open(readSuite(useKnotworkStore.getState()).suite, next.id);
    },

    setPrintOnly: (printOnly) => set({ printOnly }),

    // Bookkeeping, not an edit: nobody undoes having printed something.
    notePrinted: (pieceId, artefacts, partial, basis) => {
      const { suite } = readSuite(useKnotworkStore.getState());
      // Removed while it printed: there is no piece left to remember it on.
      if (!suite.pieces.some((p) => p.id === pieceId)) return;
      const design = designFor(suite, pieceId);
      const printed = recordPrint(design.printed, artefacts, partial, new Date().toISOString(), basis);
      writeSuite(withDesign(suite, pieceId, { ...design, printed }), { silent: true });
      // The few went to paper: the next print of that piece is the whole run again.
      if (get().pieceId === pieceId) set({ printOnly: null });
    },

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

    setBooklet: (booklet) =>
      commit("how the booklet is printed", (s) =>
        booklet.output === "shop"
          ? {
              booklet,
              card: { ...s.card, bleedMm: s.card.bleedMm || 3 },
              sheet: { ...s.sheet, page: "FIT", marginTopMm: 10, marginRightMm: 10, marginBottomMm: 10, marginLeftMm: 10, cropMarks: true },
            }
          : { booklet },
      ),

    setBackground: (hex) => commit("the background", (s) => ({ template: { ...s.template, backgroundHex: hex } })),

    setChairName: (pattern) =>
      commit("how names read", (s) => {
        // Nothing typed is the default, not "say nothing": the field shows the default as its placeholder.
        const { chairName: _old, ...template } = s.template;
        return { template: pattern.trim() ? { ...template, chairName: pattern } : template };
      }),

    applyGalleryTemplate: (entry) =>
      commit("a gallery design", (s) => ({
        ...fromGallery(entry, s.card, s.sheet, s.headers),
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
        // On a booklet, it goes on the page on screen: the cover, the inside, or the back.
        const role = previewRow(s)[PAGE_ROLE_COLUMN] as PageRole | undefined;
        const el = { ...makeElement(kind, s.card, s.headers, nextZ(s.template)), side: s.editingSide, ...(role ? { page: role } : {}) };
        return {
          template: { ...s.template, elements: [...s.template.elements, el] },
          selectedId: el.id,
        };
      }),

    updateElement: (id, patch) =>
      commit("changing the card", (s) => {
        const template = replaceElement(s, id, patch);
        // A box that follows a chair, moved by its numbers, keeps the move as a nudge.
        return "x" in patch || "y" in patch
          ? { template: { ...template, elements: template.elements.map((el) => (el.id === id ? withChairNudge(s, el) : el)) } }
          : { template };
      }),

    stampChairs: (roomId, follow, only) =>
      commit("names at their chairs", (s) => {
        const plan = s.template.elements.find((el): el is RoomElement => el.id === roomId && el.kind === "room");
        if (!plan) throw new Error(`No plan "${roomId}" on this design.`);
        // Each table's card has its own table: those boxes can only follow.
        const following = plan.show === "table" || follow;
        const covered = new Set(stampedChairs(s.template, roomId));
        const key = (table: string | null, seat: number) => `${table === null ? "" : normalise(table)}#${seat}`;
        const wanted = only ? new Set(only.map((c) => key(c.table, c.seat))) : null;
        const row = previewRow(s);
        const layout = planLayout(plan, s.room, row);
        if (typeof layout === "string") throw new Error(layout);
        // The names as the plan draws them: all at the one size the tightest allows.
        const sizePt = chairNameSize(plan, layout, makeResolveOptions(s.fonts), s.template, []);
        let z = nextZ(s.template);
        const stamped: TextElement[] = stampableChairs(plan, s.room, row).flatMap(({ table, seat, box }) => {
          const ref = { table, seat };
          const k = key(ref.table, ref.seat);
          if (covered.has(k) || (wanted && !wanted.has(k))) return [];
          return [
            {
              id: newId(),
              kind: "text",
              ...box,
              z: z++,
              template: `{{${chairToken(ref)}}}`,
              fontId: plan.fontId,
              fontSizePt: sizePt,
              align: "center",
              vAlign: "middle",
              lineHeight: 1.1,
              colorHex: plan.colorHex,
              letterSpacingMm: 0,
              fit: { mode: "shrink-then-wrap", minFontSizePt: 4, maxLines: 2, anchor: "align" },
              chair: { from: plan.id, ...ref, follow: following, dx: 0, dy: 0 },
            },
          ];
        });
        return {
          template: {
            ...s.template,
            // The plan stops naming the chairs that now have boxes of their own.
            elements: [
              ...s.template.elements.map((el) => (el.id === plan.id ? { ...plan, namesAtChairs: false } : el)),
              ...stamped,
            ],
          },
        };
      }),

    setElementBox: (id, box) =>
      commit("moving on the card", (s) => ({
        template: {
          ...s.template,
          elements: s.template.elements.map((el) => (el.id === id ? withChairNudge(s, { ...el, ...box }) : el)),
        },
      })),

    setElementCrop: (id, patch) =>
      commit("cropping an image", (s) => ({ template: replaceElement(s, id, patch as Partial<CardElement>) })),

    removeElement: (id) =>
      commit("removing from the card", (s) => {
        // Boxes that followed a plan stay where they are when it goes.
        const placed = placeChairs(s.template, s.room, previewRow(s));
        return {
          template: {
            ...s.template,
            elements: s.template.elements
              .filter((el) => el.id !== id)
              .map((el) =>
                el.kind === "text" && el.chair?.follow && el.chair.from === id
                  ? { ...(placed.elements.find((p) => p.id === el.id) as TextElement), chair: { ...el.chair, follow: false } }
                  : el,
              ),
          },
          selectedId: s.selectedId === id ? null : s.selectedId,
        };
      }),

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

    setFonts: (fonts, fontLabels, uploadedFontIds) => {
      set({ fonts, fontLabels, uploadedFontIds });
      // A booklet's page count is its service set in these faces.
      follow(useKnotworkStore.getState());
    },

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
    ...live(wedding, design, usePlaque.getState().fonts),
    designProblem: problem,
    pieceId,
    pieces: summarise(suite, s.pieces),
    // Something undone, or removed elsewhere, is no longer there to select.
    selectedId: present(s.selectedId) ? s.selectedId : null,
    cropId: present(s.cropId) ? s.cropId : null,
    // Another piece now (the one shown was undone or removed): start it afresh,
    // and its cards are not the ones that were picked.
    ...(pieceId === s.pieceId
      ? {}
      : { printOnly: null, editingSide: "front" as const, page: 0, previewGuestIndex: 0, selectedId: null, cropId: null }),
  }));
}

/**
 * The cards follow the room: a guest seated next door, a name corrected on the
 * guest list or a partner's name changed is on the card the moment it is made.
 * Only the slices a card reads are watched, so an edit to the timeline costs
 * Place cards nothing.
 */
useKnotworkStore.subscribe((state, prev) => {
  // A booklet reads the ceremony, its people and its time as well.
  const watched = ["stationery", "guests", "seating", "event", "ceremony", "cast", "timeline"] as const;
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

/** The row of the card on screen: what a chair's place is worked out for. */
function previewRow(s: PlaqueState): GuestRow {
  const artefacts = artefactsOf(s.template, s.rows, s.headers, s.rowIds);
  return (artefacts[s.previewGuestIndex] ?? artefacts[0])?.row ?? {};
}

/**
 * A box that follows a chair, put somewhere on the card on screen: kept as a
 * nudge from where that chair's name goes, so it moves with the chair and sits
 * the same way on every table's card.
 */
function withChairNudge(s: PlaqueState, el: CardElement): CardElement {
  if (el.kind !== "text" || !el.chair?.follow) return el;
  const link = el.chair;
  const plan = s.template.elements.find((p): p is RoomElement => p.id === link.from && p.kind === "room");
  const cell = plan
    ? chairCells(plan, s.room, previewRow(s)).find(
        (c) => c.seat.number === link.seat && (link.table === null || normalise(c.table.label) === normalise(link.table)),
      )
    : undefined;
  if (!cell) return el;
  const at = centredOn(el, cell.box);
  return { ...el, chair: { ...link, dx: el.x - at.x, dy: el.y - at.y } };
}

/** What Ceremony sends for: the wedding's order of service, whichever it is. */
export const ORDER_OF_SERVICE = "order-of-service";
/** The design a wedding's first order of service starts from. */
const FIRST_BOOKLET = "order-of-service-classic";

/** The piece a link names: the order of service is the wedding's first booklet, or a new one from the first design. */
export function pieceFor(id: string): string {
  if (id !== ORDER_OF_SERVICE) return id;
  return readSuite(useKnotworkStore.getState()).suite.pieces.find((p) => p.booklet)?.id ?? FIRST_BOOKLET;
}

/** Whether `id` names a piece of this wedding, or a design a piece can be made from. */
export function canOpenPiece(id: string): boolean {
  return readSuite(useKnotworkStore.getState()).suite.pieces.some((p) => p.id === id) || GALLERY.some((g) => g.id === id);
}

/** The chairs a plan's stamped boxes already name, as `table#seat` (table empty for the card's own). */
export function stampedChairs(template: Template, roomId: ElementId): string[] {
  return template.elements.flatMap((el) =>
    el.kind === "text" && el.chair?.from === roomId
      ? [`${el.chair.table === null ? "" : normalise(el.chair.table)}#${el.chair.seat}`]
      : [],
  );
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
