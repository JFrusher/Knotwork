import type {
  CardScene,
  CardSpec,
  ElementId,
  GridElement,
  ListElement,
  RoomScene,
  Pt,
  ResolvedElement,
  ResolvedImageSource,
  Template,
  TextElement,
} from "../types";
import { BUNDLED_VIEW, type IconArt } from "../../assets/icons";
import type { GuestRow } from "../data/rows";
import { interpolate, tokensIn } from "../csv/interpolate";
import { flowPlan, gridBlocks } from "./grid";
import { resolveRoom } from "./room";
import { qrPath } from "./qr";
import { chairRef, chairValues } from "./chairs";
import { transformForPanel } from "../geometry/fold";
import { ptToMm } from "../units";
import { resolveIconForRow } from "./icons";

export interface FitResult {
  lines: string[];
  fontSizePt: Pt;
  overflowed: boolean;
  /**
   * Set when the face was not available, so no real fitting decision was made.
   * The size below is the requested one, not a measured one.
   */
  missingFont?: boolean;
}

/** Injected so bindings stays pure and testable without loading a font. */
export type FitTextFn = (element: TextElement, text: string) => FitResult;
/** Block fit for a list element: the lines are already decided, only the size is not. */
export type FitBlockFn = (element: ListElement, lines: string[]) => FitResult;
/** One size for every block of a grid, fitted to its cells. */
export type FitGridFn = (
  element: GridElement,
  blocks: Array<{ heading: string; items: string[] }>,
  cell: { w: number; h: number },
) => { fontSizePt: Pt; overflowed: boolean; missingFont?: boolean };
export type IconPathFn = (iconId: string) => IconArt | null;
export type ImageFn = (imageId: string) => ResolvedImageSource | null;

export interface ResolveOptions {
  fitText: FitTextFn;
  /** Without it a list element renders nothing and says so. */
  fitBlock?: FitBlockFn;
  /** Without it a grid renders at its requested size and says the font is missing. */
  fitGrid?: FitGridFn;
  /** The seating plan a room element draws. Without it, it draws nothing and says so. */
  room?: () => RoomScene | null;
  iconPath: IconPathFn;
  /** Optional: without it, image elements resolve to nothing and warn. */
  image?: ImageFn;
  /**
   * Characters of `text` the element's face cannot draw, with a face that can
   * (E2). Injected so bindings stays free of fontkit.
   */
  missingGlyphs?: (fontId: string, text: string) => { missing: string[]; fallback: string | null };
  /**
   * Original filename for an uploaded asset id. Without it a missing asset can
   * only be named by its content hash, which tells the user nothing about which
   * file to go and find (S-D1.4).
   */
  assetName?: (id: string) => string | null;
}

export type WarningKind =
  | "overflow"
  | "missing-field"
  | "missing-glyph"
  | "missing-icon"
  | "missing-image"
  | "missing-font"
  | "unknown-element"
  | "empty-text"
  /** Rows a grid has no block for — guests with no table on a seating board. */
  | "left-out";

export interface CardWarning {
  elementId: ElementId;
  kind: WarningKind;
  detail: string;
}

export interface ResolvedCard {
  /** Card-local coordinates. `paginate` maps these onto a sheet. */
  scene: CardScene;
  warnings: CardWarning[];
}

/**
 * Turns the template plus one guest row into a renderable card.
 *
 * Fold inversion is applied here, not in a renderer: by the time an element
 * leaves this function it carries a final box and a rotation, and neither
 * renderer needs to know that folding exists.
 */
export function resolveCard(
  template: Template,
  row: GuestRow,
  card: CardSpec,
  opts: ResolveOptions,
  /**
   * Every row this artefact covers. A list element repeats over these; every
   * other element ignores them and binds to `row` as it always has. Defaults to
   * the single row, so per-row scope is unchanged.
   */
  rows: GuestRow[] = [row],
): ResolvedCard {
  const warnings: CardWarning[] = [];
  const elements: ResolvedElement[] = [];

  // Chair tokens name whoever sits in a seat of this card's table, not a column
  // of its own row: they are read from the room, once per element, and said
  // nothing for when they cannot be — with the reason.
  const chairsOf = (elementId: ElementId, text: string): GuestRow => {
    const tokens = tokensIn(text).filter((token) => chairRef(token));
    if (tokens.length === 0) return {};
    const { values, problems } = chairValues(tokens, row, opts.room?.() ?? null, template);
    for (const detail of problems) warnings.push({ elementId, kind: "missing-field", detail });
    return values;
  };
  const seated = (elementId: ElementId, text: string, base: GuestRow): GuestRow => ({ ...base, ...chairsOf(elementId, text) });

  for (const el of [...template.elements].sort((a, b) => a.z - b.z)) {
    const placed = transformForPanel({ x: el.x, y: el.y, w: el.w, h: el.h }, card);
    const base = {
      id: el.id,
      x: placed.box.x,
      y: placed.box.y,
      w: placed.box.w,
      h: placed.box.h,
      rotationDeg: placed.rotationDeg,
      z: el.z,
    };

    switch (el.kind) {
      case "text": {
        const { text, missing } = interpolate(el.template, seated(el.id, el.template, row));
        for (const name of missing) {
          warnings.push({
            elementId: el.id,
            kind: "missing-field",
            detail: `No column named "${name}".`,
          });
        }
        const fit = opts.fitText(el, text);
        if (fit.missingFont) {
          // Blocking, not cosmetic: without metrics the size and the line breaks
          // are guesses, so the preview and the print would disagree.
          warnings.push({
            elementId: el.id,
            kind: "missing-font",
            detail: `The font "${assetLabel(opts, el.fontId)}" is not on this device, so this text cannot be sized correctly.`,
          });
        }
        if (fit.overflowed) {
          warnings.push({
            elementId: el.id,
            kind: "overflow",
            detail: `"${text}" does not fit at ${el.fit.minFontSizePt}pt.`,
          });
        }
        if (text.length === 0) {
          warnings.push({ elementId: el.id, kind: "empty-text", detail: "Resolves to nothing." });
        }
        // Tofu on a printed card is unrecoverable, so it is found per row —
        // one guest in a hundred and fifty is exactly the case that slips past.
        const glyphs = opts.missingGlyphs?.(el.fontId, text);
        if (glyphs && glyphs.missing.length > 0) {
          warnings.push({
            elementId: el.id,
            kind: "missing-glyph",
            detail: `"${text}" uses ${glyphs.missing.map((c) => `"${c}"`).join(", ")}, which this font cannot print.${
              glyphs.fallback ? ` ${glyphs.fallback} can.` : " No loaded font can."
            }`,
          });
        }
        elements.push({
          ...base,
          kind: "text",
          lines: fit.lines,
          fontId: el.fontId,
          fontSizePt: fit.fontSizePt,
          align: el.align,
          vAlign: el.vAlign,
          anchor: el.fit.anchor,
          lineHeight: el.lineHeight,
          colorHex: el.colorHex,
          letterSpacingMm: el.letterSpacingMm,
          overflowed: fit.overflowed,
          ...(el.optical ? { optical: el.optical } : {}),
        });
        break;
      }

      case "icon": {
        const iconId = resolveIconForRow(row, el.sourceField, el.rules, el.fallbackIconId);
        const art = iconId ? opts.iconPath(iconId) : null;
        if (iconId && art === null) {
          warnings.push({
            elementId: el.id,
            kind: "missing-icon",
            detail: `Icon "${iconId}" is not loaded.`,
          });
        }
        elements.push({
          ...base,
          kind: "icon",
          pathD: art?.d ?? null,
          cutD: art?.cut ?? null,
          view: art?.view ?? BUNDLED_VIEW,
          colorHex: el.colorHex,
          cutHex: template.backgroundHex ?? "#ffffff",
        });
        break;
      }

      case "list": {
        // One line per row, then a block fit. It leaves as a resolved TEXT
        // element: the renderers already know how to draw a stack of lines, so
        // the list element needed no drawing code at all.
        const lines: string[] = [];
        const missingColumns: string[] = [];
        const listChairs = chairsOf(el.id, el.itemTemplate);
        for (const source of rows) {
          const { text, missing } = interpolate(el.itemTemplate, { ...source, ...listChairs });
          for (const name of missing) {
            if (!missingColumns.includes(name)) missingColumns.push(name);
          }
          if (el.skipEmpty && text.trim().length === 0) continue;
          lines.push(el.bullet ? `${el.bullet} ${text}` : text);
        }
        for (const name of missingColumns) {
          warnings.push({
            elementId: el.id,
            kind: "missing-field",
            detail: `No column named "${name}".`,
          });
        }
        if (lines.length === 0) {
          warnings.push({
            elementId: el.id,
            kind: "empty-text",
            detail: "This list has no rows to show.",
          });
        }

        const fit = opts.fitBlock?.(el, lines) ?? {
          lines,
          fontSizePt: el.fontSizePt,
          overflowed: false,
          missingFont: true,
        };
        if (fit.missingFont) {
          warnings.push({
            elementId: el.id,
            kind: "missing-font",
            detail: `The font "${assetLabel(opts, el.fontId)}" is not on this device, so this list cannot be sized correctly.`,
          });
        }
        if (fit.overflowed) {
          warnings.push({
            elementId: el.id,
            kind: "overflow",
            detail: `${lines.length} lines do not fit at ${el.fit.minFontSizePt}pt.`,
          });
        }

        elements.push({
          ...base,
          kind: "text",
          lines: fit.lines,
          fontId: el.fontId,
          fontSizePt: fit.fontSizePt,
          align: el.align,
          vAlign: el.vAlign,
          anchor: el.fit.anchor,
          lineHeight: el.lineHeight,
          colorHex: el.colorHex,
          letterSpacingMm: el.letterSpacingMm,
          overflowed: fit.overflowed,
          ...(el.optical ? { optical: el.optical } : {}),
        });
        break;
      }

      case "qr": {
        const { text, missing } = interpolate(el.data, seated(el.id, el.data, row));
        for (const name of missing) {
          warnings.push({ elementId: el.id, kind: "missing-field", detail: `No column named "${name}".` });
        }
        if (!text.trim()) {
          warnings.push({
            elementId: el.id,
            kind: "empty-text",
            detail: el.data.includes("Guest Link")
              ? "There is no guest link to point at yet. Publish one from the Data menu, and the code fills itself in."
              : "This code has nothing to say.",
          });
          break;
        }
        const code = qrPath(text);
        elements.push({ ...base, kind: "icon", pathD: code.pathD, cutD: null, view: code.view, colorHex: el.colorHex, cutHex: el.colorHex });
        break;
      }

      case "room": {
        const resolved = resolveRoom(el, row, card, opts, template);
        warnings.push(...resolved.warnings);
        elements.push(...resolved.elements);
        break;
      }

      case "grid": {
        const resolved = resolveGrid(el, rows, card, opts);
        warnings.push(...resolved.warnings);
        elements.push(...resolved.elements);
        break;
      }

      case "rect":
        elements.push({
          ...base,
          kind: "rect",
          fillHex: el.fillHex,
          strokeHex: el.strokeHex,
          strokeWidthMm: el.strokeWidthMm,
          dashed: el.dashed,
        });
        break;

      case "line":
        elements.push({
          ...base,
          kind: "line",
          strokeHex: el.strokeHex,
          strokeWidthMm: el.strokeWidthMm,
          dashed: el.dashed,
        });
        break;

      case "image": {
        const source = el.imageId ? (opts.image?.(el.imageId) ?? null) : null;
        const missingName =
          el.imageId && !source ? assetLabel(opts, el.imageId) : null;
        if (missingName) {
          warnings.push({
            elementId: el.id,
            kind: "missing-image",
            detail: `"${missingName}" is not on this device.`,
          });
        }
        elements.push({
          ...base,
          kind: "image",
          image: source,
          missingName,
          fit: el.fit,
          opacity: el.opacity,
          // Spread, not defaulted: a design with no crop resolves to an element
          // with no crop, so nothing downstream has to tell "centred" apart
          // from "never cropped".
          ...(el.zoom === undefined ? {} : { zoom: el.zoom }),
          ...(el.focusX === undefined ? {} : { focusX: el.focusX }),
          ...(el.focusY === undefined ? {} : { focusY: el.focusY }),
        });
        break;
      }

      default: {
        // Only reachable from storage written by a different version. Saying so
        // beats dropping an element the user can see in the layer list.
        const unknown: { kind?: unknown } = el;
        warnings.push({
          elementId: (el as { id: string }).id,
          kind: "unknown-element",
          detail: `This design contains a "${String(unknown.kind)}" element that this version cannot draw.`,
        });
      }
    }
  }

  return { scene: { elements, backgroundHex: template.backgroundHex }, warnings };
}

/** A grid's heading pieces are `<grid id>/h<n>`, its lines `<grid id>/i<n>`. */
export const GRID_HEADING = "/h";
const GRID_LINES = "/i";

/**
 * A grid's blocks, cut into equal cells left to right then down, each a
 * heading and a stack of lines as ordinary text. Every cell is placed through
 * the fold on its own, so a grid on a folded card lands as any element would.
 */
function resolveGrid(
  el: GridElement,
  rows: GuestRow[],
  card: CardSpec,
  opts: ResolveOptions,
): { elements: ResolvedElement[]; warnings: CardWarning[] } {
  const warnings: CardWarning[] = [];
  const { blocks, leftOut, missing } = gridBlocks(el, rows);
  if (leftOut > 0) {
    warnings.push({
      elementId: el.id,
      kind: "left-out",
      detail:
        leftOut === 1
          ? `One row has no ${el.groupBy}, so it is not on this grid.`
          : `${leftOut} rows have no ${el.groupBy}, so they are not on this grid.`,
    });
  }
  for (const name of missing) {
    warnings.push({ elementId: el.id, kind: "missing-field", detail: `No column named "${name}".` });
  }
  if (blocks.length === 0) {
    warnings.push({ elementId: el.id, kind: "empty-text", detail: "This grid has no blocks to show." });
    return { elements: [], warnings };
  }

  const flowing = el.layout === "columns";
  const columns = Math.max(1, Math.round(el.columns));
  const across = flowing ? columns : Math.min(columns, blocks.length);
  const down = flowing ? 1 : Math.ceil(blocks.length / across);
  const cell = {
    w: (el.w - el.gapMm * (across - 1)) / across,
    h: (el.h - el.gapMm * (down - 1)) / down,
  };
  // Columns are laid out at the size asked for, so a long list carries on
  // over the page rather than shrinking into illegibility; only a line too
  // wide for its column makes the text smaller.
  const fit = opts.fitGrid?.(
    el,
    blocks.map((block) => ({ heading: block.heading, items: block.lines })),
    flowing ? { w: cell.w, h: Number.POSITIVE_INFINITY } : cell,
  ) ?? { fontSizePt: el.fontSizePt, overflowed: false, missingFont: true };
  if (fit.missingFont) {
    warnings.push({
      elementId: el.id,
      kind: "missing-font",
      detail: `The font "${assetLabel(opts, el.fontId)}" or "${assetLabel(opts, el.headingFontId)}" is not on this device, so this grid cannot be sized correctly.`,
    });
  }
  if (fit.overflowed) {
    warnings.push({
      elementId: el.id,
      kind: "overflow",
      detail: flowing
        ? `Some lines are too wide for their column at ${el.fit.minFontSizePt}pt. Try fewer columns or a bigger box.`
        : `${blocks.length} blocks do not fit at ${el.fit.minFontSizePt}pt. Try more columns or a bigger box.`,
    });
  }

  const headingPt = fit.fontSizePt * el.headingScale;
  // Slots are planned at the size asked for; text shrunk for width sits in them.
  const headingH = ptToMm((flowing ? el.fontSizePt : fit.fontSizePt) * el.headingScale * el.lineHeight);
  const lineH = ptToMm(el.fontSizePt * el.lineHeight);
  const elements: ResolvedElement[] = [];
  const text = (id: string, box: { x: number; y: number; w: number; h: number }, piece: {
    lines: string[];
    fontId: string;
    fontSizePt: Pt;
    colorHex: string;
  }): ResolvedElement => {
    const placed = transformForPanel(box, card);
    return {
      id: `${el.id}${id}`,
      sourceId: el.id,
      ...placed.box,
      rotationDeg: placed.rotationDeg,
      z: el.z,
      kind: "text",
      ...piece,
      align: el.align,
      vAlign: "top",
      anchor: "align",
      lineHeight: el.lineHeight,
      letterSpacingMm: el.letterSpacingMm,
      overflowed: fit.overflowed,
    };
  };
  const heading = (n: number, x: number, y: number, block: { heading: string }) =>
    text(`${GRID_HEADING}${n}`, { x, y, w: cell.w, h: headingH }, {
      lines: block.heading ? [block.heading] : [],
      fontId: el.headingFontId,
      fontSizePt: headingPt,
      colorHex: el.headingColorHex,
    });
  const body = (n: number, x: number, y: number, h: number, lines: string[]) =>
    text(`${GRID_LINES}${n}`, { x, y, w: cell.w, h }, {
      lines,
      fontId: el.fontId,
      fontSizePt: fit.fontSizePt,
      colorHex: el.colorHex,
    });

  if (!flowing) {
    blocks.forEach((block, index) => {
      const x = el.x + (index % across) * (cell.w + el.gapMm);
      const y = el.y + Math.floor(index / across) * (cell.h + el.gapMm);
      elements.push(heading(index, x, y, block), body(index, x, y + headingH, Math.max(0, cell.h - headingH), block.lines));
    });
    return { elements, warnings };
  }

  // What is here is one page's worth: `withParts` cut the list to fit. Anything
  // the plan still puts on a later page did not fit at all, and is said so.
  const runs = flowPlan(el, blocks.map((block) => block.lines.length));
  const spilt = runs.filter((run) => run.page > 0).reduce((sum, run) => sum + run.to - run.from, 0);
  if (spilt > 0) {
    warnings.push({
      elementId: el.id,
      kind: "overflow",
      detail: `${spilt} lines do not fit in these columns.`,
    });
  }
  runs
    .filter((run) => run.page === 0)
    .forEach((run, n) => {
      const x = el.x + run.column * (cell.w + el.gapMm);
      let y = el.y + run.y;
      if (run.heading) {
        elements.push(heading(n, x, y, blocks[run.block]!));
        y += headingH;
      }
      const lines = blocks[run.block]!.lines.slice(run.from, run.to);
      if (lines.length > 0) elements.push(body(n, x, y, lines.length * lineH, lines));
    });
  return { elements, warnings };
}

/** The filename the user knows the asset by, falling back to its id. */
function assetLabel(opts: ResolveOptions, id: string): string {
  return opts.assetName?.(id) ?? id;
}

/** Fit stub for tests and for previewing before a font has loaded. */
export const noFit: FitTextFn = (element, text) => ({
  lines: text ? [text] : [],
  fontSizePt: element.fontSizePt,
  overflowed: false,
});
