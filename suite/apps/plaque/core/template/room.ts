import { normalise } from "../data/artefacts";
import type { GuestRow } from "../data/rows";
import { transformForPanel } from "../geometry/fold";
import type { CardSpec, Mm, ResolvedElement, RoomElement, RoomScene, RoomTable, TextElement } from "../types";
import type { CardWarning, ResolveOptions } from "./bindings";

/** A seat, as a path the icon pipeline can fill: a circle of radius 1 about the origin. */
const SEAT_PATH = "M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z";
const SEAT_VIEW = { x: -1, y: -1, w: 2, h: 2 };
/** A name's cell is this many seat radii deep, hanging off the chair away from the table. */
const NAME_DEPTH = 3;
/** Room left round a single table so its names are not cut off. */
const TABLE_MARGIN = NAME_DEPTH + 1.5;
/** A table's own name is set this much larger than the guests'. */
const LABEL_SCALE = 1.3;

type Box = { x: Mm; y: Mm; w: Mm; h: Mm };

/**
 * The room to scale in the element's box: walls as lines, tables and chairs as
 * filled shapes, and names and labels as ordinary text, so neither renderer
 * knows a floor plan exists. Labels stay upright however a table is turned —
 * a turned top table's names must still read.
 *
 * With `show: "table"` it is the one table this artefact is for — a table
 * card's own little map — found by the artefact's `Table`.
 */
export function resolveRoom(
  el: RoomElement,
  row: GuestRow,
  card: CardSpec,
  opts: ResolveOptions,
): { elements: ResolvedElement[]; warnings: CardWarning[] } {
  const warnings: CardWarning[] = [];
  const scene = opts.room?.() ?? null;
  if (!scene || scene.tables.length === 0) {
    warnings.push({ elementId: el.id, kind: "empty-text", detail: "There is no seating plan to draw yet." });
    return { elements: [], warnings };
  }

  let tables = scene.tables;
  let bounds = scene.bounds;
  if (el.show === "table") {
    const wanted = normalise(row["Table"] ?? "");
    const table = scene.tables.find((t) => normalise(t.label) === wanted);
    if (!table) {
      warnings.push({
        elementId: el.id,
        kind: "missing-field",
        detail: wanted ? `The plan has no table called "${row["Table"]}".` : "This card is not for a table.",
      });
      return { elements: [], warnings };
    }
    tables = [table];
    bounds = tableBounds(table, scene.seatRadius);
  }

  // The plan scaled to fit the box, centred, one scale both ways.
  const scale = Math.min(el.w / bounds.w, el.h / bounds.h);
  const ox = el.x + (el.w - bounds.w * scale) / 2 - bounds.x * scale;
  const oy = el.y + (el.h - bounds.h * scale) / 2 - bounds.y * scale;
  const at = (x: number, y: number) => ({ x: ox + x * scale, y: oy + y * scale });

  const elements: ResolvedElement[] = [];
  let n = 0;
  const place = (box: Box, rotationDeg = 0) => {
    const placed = transformForPanel(box, card);
    return {
      id: `${el.id}/${n++}`,
      sourceId: el.id,
      ...placed.box,
      rotationDeg: placed.rotationDeg + rotationDeg,
      z: el.z,
    };
  };

  if (el.walls && el.show === "room") {
    for (const [a, b] of scene.walls) {
      const p = at(a.x, a.y);
      const q = at(b.x, b.y);
      const length = Math.hypot(q.x - p.x, q.y - p.y);
      if (length === 0) continue;
      const box = { x: (p.x + q.x) / 2 - length / 2, y: (p.y + q.y) / 2, w: length, h: 0 };
      elements.push({
        ...place(box, (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI),
        kind: "line",
        strokeHex: el.wallHex,
        strokeWidthMm: 0.5,
        dashed: false,
      });
    }
  }

  const seatR = scene.seatRadius * scale;
  for (const table of tables) {
    const centre = at(table.x, table.y);
    const w = table.view.w * scale;
    const h = table.view.h * scale;
    // The path's box sits where its view does about the table's centre.
    const box = { x: centre.x + table.view.x * scale, y: centre.y + table.view.y * scale, w, h };
    elements.push({
      ...place(box, table.rotationDeg),
      kind: "icon",
      pathD: table.pathD,
      cutD: null,
      view: table.view,
      colorHex: el.tableHex,
      cutHex: el.tableHex,
    });

    for (const seat of table.seats) {
      const c = at(seat.x, seat.y);
      elements.push({
        ...place({ x: c.x - seatR, y: c.y - seatR, w: seatR * 2, h: seatR * 2 }),
        kind: "icon",
        pathD: SEAT_PATH,
        cutD: null,
        view: SEAT_VIEW,
        colorHex: el.seatHex,
        cutHex: el.seatHex,
      });
    }

    if (el.tableLabels && table.label) {
      const size = Math.min(w, h) * 0.8;
      const label = fitted(el, table.label, { x: centre.x - size / 2, y: centre.y - size / 4, w: size, h: size / 2 }, el.fontSizePt * LABEL_SCALE, opts, warnings);
      if (label) elements.push({ ...place(label.box), ...label.text });
    }

    if (el.seatLabels !== "none") {
      const across = Math.max(seatR * 2, nearestSeat(table, scale) * 0.96);
      for (const seat of table.seats) {
        const words = el.seatLabels === "number" ? String(seat.number) : el.seatLabels === "first" ? seat.first : seat.name;
        if (!words) continue;
        const c = at(seat.x, seat.y);
        const box =
          el.seatLabels === "number"
            ? { x: c.x - seatR, y: c.y - seatR, w: seatR * 2, h: seatR * 2 }
            : nameCell(c, seat.out, seatR, across);
        const name = fitted(el, words, box, el.fontSizePt, opts, warnings);
        if (name) elements.push({ ...place(name.box), ...name.text });
      }
    }
  }

  return { elements, warnings };
}

/** One table and its chairs, with room round them for the names. */
function tableBounds(table: RoomTable, seatRadius: number) {
  const reach = seatRadius * TABLE_MARGIN;
  const xs = table.seats.map((s) => s.x).concat(table.x - table.view.w / 2, table.x + table.view.w / 2);
  const ys = table.seats.map((s) => s.y).concat(table.y - table.view.h / 2, table.y + table.view.h / 2);
  const x = Math.min(...xs) - reach;
  const y = Math.min(...ys) - reach;
  return { x, y, w: Math.max(...xs) + reach - x, h: Math.max(...ys) + reach - y };
}

/** The closest two chairs at a table come, on paper: how wide a name may be. */
function nearestSeat(table: RoomTable, scale: number): Mm {
  let nearest = Number.POSITIVE_INFINITY;
  table.seats.forEach((a, i) => {
    for (const b of table.seats.slice(i + 1)) nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y));
  });
  return Number.isFinite(nearest) ? nearest * scale : 0;
}

/** A name's cell: hanging off the chair, away from the table, as wide as the gap to the next chair. */
function nameCell(seat: { x: Mm; y: Mm }, out: { x: number; y: number }, seatR: Mm, across: Mm): Box {
  const depth = seatR * NAME_DEPTH;
  const reach = seatR + depth / 2;
  const cx = seat.x + out.x * reach;
  const cy = seat.y + out.y * reach;
  return { x: cx - across / 2, y: cy - depth / 2, w: across, h: depth };
}

/** Text fitted to a box with the element's face, or nothing when it is empty. */
function fitted(
  el: RoomElement,
  words: string,
  box: Box,
  sizePt: number,
  opts: ResolveOptions,
  warnings: CardWarning[],
): { box: Box; text: Omit<Extract<ResolvedElement, { kind: "text" }>, "id" | "sourceId" | "x" | "y" | "w" | "h" | "rotationDeg" | "z"> } | null {
  const probe: TextElement = {
    kind: "text",
    id: el.id,
    ...box,
    z: el.z,
    template: words,
    fontId: el.fontId,
    fontSizePt: sizePt,
    align: "center",
    vAlign: "middle",
    lineHeight: 1.1,
    colorHex: el.colorHex,
    letterSpacingMm: 0,
    // Two lines before shrinking further: "Bartholomew Sorensen" breaks well.
    fit: { mode: "shrink-then-wrap", minFontSizePt: 1, maxLines: 2, anchor: "align" },
  };
  const fit = opts.fitText(probe, words);
  if (fit.missingFont && !warnings.some((w) => w.kind === "missing-font")) {
    warnings.push({
      elementId: el.id,
      kind: "missing-font",
      detail: `The font "${el.fontId}" is not on this device, so the names on the plan cannot be sized correctly.`,
    });
  }
  if (fit.lines.length === 0) return null;
  return {
    box,
    text: {
      kind: "text",
      lines: fit.lines,
      fontId: el.fontId,
      fontSizePt: fit.fontSizePt,
      align: "center",
      vAlign: "middle",
      anchor: "align",
      lineHeight: 1.1,
      colorHex: el.colorHex,
      letterSpacingMm: 0,
      overflowed: false,
    },
  };
}
