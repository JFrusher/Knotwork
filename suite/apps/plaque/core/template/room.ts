import { normalise } from "../data/artefacts";
import type { GuestRow } from "../data/rows";
import { transformForPanel } from "../geometry/fold";
import type {
  CardSpec,
  ListElement,
  Mm,
  ResolvedElement,
  RoomElement,
  RoomScene,
  RoomSeat,
  RoomTable,
  Template,
  TextElement,
} from "../types";
import { chairName } from "./chairs";
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
type Drawn = { elements: ResolvedElement[]; warnings: CardWarning[] };

/**
 * Plans already drawn, by the measurer and the room they were drawn with. A
 * plan reads nothing of the card's guest but its table, so a hundred escort
 * cards with the room on them draw it once, not a hundred times.
 */
const drawnPlans = new WeakMap<object, WeakMap<RoomScene, Map<string, Drawn>>>();

export function resolveRoom(
  el: RoomElement,
  row: GuestRow,
  card: CardSpec,
  opts: ResolveOptions,
  template: Pick<Template, "chairName">,
): Drawn {
  const scene = opts.room?.() ?? null;
  if (!scene) return drawRoom(el, row, card, opts, template, null);
  const byScene = drawnPlans.get(opts.fitText) ?? new WeakMap<RoomScene, Map<string, Drawn>>();
  drawnPlans.set(opts.fitText, byScene);
  const plans = byScene.get(scene) ?? new Map<string, Drawn>();
  byScene.set(scene, plans);
  const key = JSON.stringify([el, card, template.chairName ?? null, el.show === "table" ? (row["Table"] ?? "") : null]);
  const drawn = plans.get(key) ?? drawRoom(el, row, card, opts, template, scene);
  plans.set(key, drawn);
  return { elements: [...drawn.elements], warnings: [...drawn.warnings] };
}

function drawRoom(
  el: RoomElement,
  row: GuestRow,
  card: CardSpec,
  opts: ResolveOptions,
  template: Pick<Template, "chairName">,
  scene: RoomScene | null,
): Drawn {
  const warnings: CardWarning[] = [];
  const layout = planLayout(el, scene, row);
  if (typeof layout === "string") {
    warnings.push({ elementId: el.id, kind: scene ? "missing-field" : "empty-text", detail: layout });
    return { elements: [], warnings };
  }
  const { tables, scale, at, seatR, walls } = layout;

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
    for (const [a, b] of walls) {
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
      // On the table where the names are round it; above it where they are in it.
      const box = table.numbered
        ? { x: centre.x - size / 2, y: centre.y - size / 4, w: size, h: size / 2 }
        : { x: centre.x - size / 2, y: centre.y - extentY(table) * scale - seatR * 2 - size / 2, w: size, h: size / 2 };
      const label = fitted(el, table.label, box, el.fontSizePt * LABEL_SCALE, opts, warnings);
      if (label) elements.push({ ...place(label.box), ...label.text });
    }

    const named = table.seats.flatMap((seat) => {
      const words = seat.row ? chairName(template, seat.row) : "";
      return words ? [{ seat, words }] : [];
    });
    if (!table.numbered && named.length > 0) {
      // Guests who sit where they like are named inside the table, as Seating
      // shows them: never at a chair, which would promise a seat that is not theirs.
      for (const column of listed(el, named.map((n) => n.words), uprightInterior(table, centre, scale), opts, warnings)) {
        elements.push({ ...place(column.box), ...column.text });
      }
    }
  }

  // Each name at its own chair, hanging outward, all at one size — unless the
  // names have been stamped out as boxes of their own.
  if (el.namesAtChairs) {
    const size = chairNameSize(el, layout, opts, template, warnings);
    for (const { words, box } of chairNames(el, layout, template)) {
      const name = fitted(el, words, box, size, opts, warnings);
      if (name) elements.push({ ...place(name.box), ...name.text });
    }
  }

  return { elements, warnings };
}

/** Where a plan draws: its tables, scaled and centred in its box. */
interface PlanLayout {
  tables: RoomTable[];
  scale: number;
  /** The plan's own coordinates to the card's, in millimetres. */
  at: (x: number, y: number) => { x: Mm; y: Mm };
  /** A chair's radius on the card. */
  seatR: Mm;
  walls: RoomScene["walls"];
}

/**
 * How a room element lays its plan out on a card for `row` — the whole room,
 * or the card's own table — or why it cannot.
 */
export function planLayout(
  el: Pick<RoomElement, "show" | "x" | "y" | "w" | "h">,
  scene: RoomScene | null,
  row: GuestRow,
): PlanLayout | string {
  if (!scene || scene.tables.length === 0) return "There is no seating plan to draw yet.";
  let tables = scene.tables;
  let bounds = scene.bounds;
  if (el.show === "table") {
    const wanted = normalise(row["Table"] ?? "");
    const table = scene.tables.find((t) => normalise(t.label) === wanted);
    if (!table) return wanted ? `The plan has no table called "${row["Table"]}".` : "This card is not for a table.";
    tables = [table];
    bounds = tableBounds(table, scene.seatRadius);
  }
  // The plan scaled to fit the box, centred, one scale both ways.
  const scale = Math.min(el.w / bounds.w, el.h / bounds.h);
  const ox = el.x + (el.w - bounds.w * scale) / 2 - bounds.x * scale;
  const oy = el.y + (el.h - bounds.h * scale) / 2 - bounds.y * scale;
  return {
    tables,
    scale,
    at: (x, y) => ({ x: ox + x * scale, y: oy + y * scale }),
    seatR: scene.seatRadius * scale,
    walls: scene.walls,
  };
}

/** Where each chair's name goes at a table that numbers its seats: hanging off the chair, away from the table. */
function tableCells(layout: PlanLayout, table: RoomTable, gap: number): Array<{ seat: RoomSeat; box: Box }> {
  if (!table.numbered) return [];
  const across = Math.max(layout.seatR * 2, nearestSeat(table, layout.scale) * 0.96);
  return table.seats.map((seat) => ({
    seat,
    box: nameCell(layout.at(seat.x, seat.y), seat.out, layout.seatR, across, gap),
  }));
}

/** Every chair a plan names, with where its name goes on the card. */
export function chairCells(
  el: Pick<RoomElement, "show" | "x" | "y" | "w" | "h" | "nameGap">,
  scene: RoomScene | null,
  row: GuestRow,
): Array<{ table: RoomTable; seat: RoomSeat; box: Box }> {
  const layout = planLayout(el, scene, row);
  if (typeof layout === "string") return [];
  return layout.tables.flatMap((table) => tableCells(layout, table, el.nameGap).map((cell) => ({ table, ...cell })));
}

/**
 * The chairs a plan's names can be stamped from, each with where its box goes
 * on the card on screen. On the whole room, every numbered chair. On a table's
 * own map, seat n of every table: the card's own table first, then any seat
 * only a bigger table has, placed as that table's card would place it.
 */
export function stampableChairs(
  el: RoomElement,
  scene: RoomScene | null,
  row: GuestRow,
): Array<{ table: string | null; seat: number; label: string; box: Box }> {
  if (el.show === "room") {
    return chairCells(el, scene, row).map(({ table, seat, box }) => ({ table: table.label, seat: seat.number, label: `${table.label} ${seat.number}`, box }));
  }
  const own = normalise(row["Table"] ?? "");
  const tables = [...(scene?.tables ?? [])].sort((a, b) => Number(normalise(b.label) === own) - Number(normalise(a.label) === own));
  const seen = new Map<number, Box>();
  for (const table of tables) {
    for (const { seat, box } of chairCells(el, scene, { ...row, Table: table.label })) {
      if (!seen.has(seat.number)) seen.set(seat.number, box);
    }
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seat, box]) => ({ table: null, seat, label: `Seat ${seat}`, box }));
}

/** Each name at a chair the plan draws, in the cell it is drawn in. */
function chairNames(el: RoomElement, layout: PlanLayout, template: Pick<Template, "chairName">): Array<{ words: string; box: Box }> {
  return layout.tables.flatMap((table) =>
    tableCells(layout, table, el.nameGap).flatMap(({ seat, box }) => {
      const words = seat.row ? chairName(template, seat.row) : "";
      return words ? [{ words, box }] : [];
    }),
  );
}

/**
 * The one size a plan names its chairs at: the largest the tightest of them
 * allows, so no guest reads smaller than the one beside them for a longer name.
 */
export function chairNameSize(
  el: RoomElement,
  layout: PlanLayout,
  opts: Pick<ResolveOptions, "fitText">,
  template: Pick<Template, "chairName">,
  warnings: CardWarning[],
): number {
  const sizes = chairNames(el, layout, template).map(
    ({ words, box }) => fitted(el, words, box, el.fontSizePt, opts, warnings)?.text.fontSizePt ?? el.fontSizePt,
  );
  return Math.min(el.fontSizePt, ...sizes);
}

/**
 * The design with every box that follows a chair moved to that chair's name
 * on this card, nudged as it was nudged. Every place a design is drawn or
 * edited goes through this, so what is grabbed on screen is what prints, on
 * every table's card. A box whose chair this card does not have stays put: it
 * names nobody here.
 */
export function placeChairs(template: Template, scene: RoomScene | null, row: GuestRow): Template {
  if (!template.elements.some((el) => el.kind === "text" && el.chair?.follow)) return template;
  const cellsOf = new Map<string, ReturnType<typeof chairCells>>();
  const elements = template.elements.map((el) => {
    if (el.kind !== "text" || !el.chair?.follow) return el;
    const link = el.chair;
    const plan = template.elements.find((p): p is RoomElement => p.id === link.from && p.kind === "room");
    if (!plan) return el;
    const cells = cellsOf.get(plan.id) ?? chairCells(plan, scene, row);
    cellsOf.set(plan.id, cells);
    const cell = cells.find(
      (c) => c.seat.number === link.seat && (link.table === null || normalise(c.table.label) === normalise(link.table)),
    );
    if (!cell) return el;
    const at = centredOn(el, cell.box);
    return { ...el, x: at.x + link.dx, y: at.y + link.dy };
  });
  return { ...template, elements };
}

/**
 * Where a box of its own size sits centred on a chair's cell: the nudge is
 * measured from here. By centre, not corner — a table's own map draws each
 * table at its own scale, so the cells differ in size from card to card.
 */
export function centredOn(el: { w: Mm; h: Mm }, cell: Box): { x: Mm; y: Mm } {
  return { x: cell.x + (cell.w - el.w) / 2, y: cell.y + (cell.h - el.h) / 2 };
}

/** How far a table reaches above and below its centre, turned as it is. */
function extentY(table: RoomTable): number {
  const rad = (table.rotationDeg * Math.PI) / 180;
  return Math.abs((table.view.w / 2) * Math.sin(rad)) + Math.abs((table.view.h / 2) * Math.cos(rad));
}

/**
 * The table's interior as an upright box on the page, however the table is
 * turned: names inside it must still read. Turned square-on, the box turns
 * with it; turned at an angle, a square that fits inside either way.
 */
function uprightInterior(table: RoomTable, centre: { x: Mm; y: Mm }, scale: number): Box {
  const inside = table.interior;
  const rad = (table.rotationDeg * Math.PI) / 180;
  const quarter = Math.round(table.rotationDeg / 90);
  const square = Math.abs(table.rotationDeg - quarter * 90) < 1;
  const [w, h] = square
    ? quarter % 2 === 0
      ? [inside.w, inside.h]
      : [inside.h, inside.w]
    : [Math.min(inside.w, inside.h) * 0.7, Math.min(inside.w, inside.h) * 0.7];
  // The interior's own centre, turned with the table (a half-circle's is off-centre).
  const cx = inside.x + inside.w / 2;
  const cy = inside.y + inside.h / 2;
  const ox = cx * Math.cos(rad) - cy * Math.sin(rad);
  const oy = cx * Math.sin(rad) + cy * Math.cos(rad);
  return {
    x: centre.x + (ox - w / 2) * scale,
    y: centre.y + (oy - h / 2) * scale,
    w: w * scale,
    h: h * scale,
  };
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

/**
 * A name's cell: hanging off the chair, away from the table, `gap` chair radii
 * clear of it, as wide as the gap to the next chair.
 */
function nameCell(seat: { x: Mm; y: Mm }, out: { x: number; y: number }, seatR: Mm, across: Mm, gap: number): Box {
  const depth = seatR * NAME_DEPTH;
  const reach = seatR * (1 + gap) + depth / 2;
  const cx = seat.x + out.x * reach;
  const cy = seat.y + out.y * reach;
  return { x: cx - across / 2, y: cy - depth / 2, w: across, h: depth };
}

/** Most columns a table's names are spread across. */
const MAX_COLUMNS = 6;
/** The gutter between columns of names in a table, as a share of the table's inside: never touching. */
const COLUMN_GAP = 0.08;

/**
 * Names fitted inside a box as Seating lays them in a table: in as many
 * columns as make them largest — one down a round table, several along a long
 * one — every column at the one size.
 */
function listed(
  el: RoomElement,
  lines: string[],
  box: Box,
  opts: ResolveOptions,
  warnings: CardWarning[],
): Array<{ box: Box; text: Omit<Extract<ResolvedElement, { kind: "text" }>, "id" | "sourceId" | "x" | "y" | "w" | "h" | "rotationDeg" | "z"> }> {
  if (lines.length === 0) return [];
  const fitColumn = (w: Mm, column: string[]) => {
    const probe: ListElement = {
      kind: "list",
      id: el.id,
      x: 0,
      y: 0,
      w,
      h: box.h,
      z: el.z,
      itemTemplate: "",
      bullet: "",
      skipEmpty: true,
      fontId: el.fontId,
      fontSizePt: el.fontSizePt,
      align: "center",
      vAlign: "middle",
      lineHeight: 1.15,
      colorHex: el.colorHex,
      letterSpacingMm: 0,
      fit: { mode: "shrink", minFontSizePt: 1, maxLines: 1, anchor: "align" },
    };
    return opts.fitBlock?.(probe, column) ?? { lines: column, fontSizePt: el.fontSizePt, overflowed: false, missingFont: true };
  };

  let best: { columns: string[][]; sizePt: number; missingFont: boolean } | null = null;
  for (let count = 1; count <= Math.min(lines.length, MAX_COLUMNS); count++) {
    const per = Math.ceil(lines.length / count);
    const columns = Array.from({ length: count }, (_, c) => lines.slice(c * per, (c + 1) * per)).filter((c) => c.length > 0);
    const fits = columns.map((column) => fitColumn(columnWidth(box.w, columns.length), column));
    const sizePt = Math.min(...fits.map((fit) => fit.fontSizePt));
    // Fewer columns win a tie: a single list reads most like a list.
    if (!best || sizePt > best.sizePt) best = { columns, sizePt, missingFont: fits.some((fit) => fit.missingFont) };
  }
  if (best!.missingFont && !warnings.some((w) => w.kind === "missing-font")) {
    warnings.push({
      elementId: el.id,
      kind: "missing-font",
      detail: `The font "${el.fontId}" is not on this device, so the names on the plan cannot be sized correctly.`,
    });
  }
  const w = columnWidth(box.w, best!.columns.length);
  return best!.columns.map((column, c) => ({
    box: { x: box.x + c * (w + box.w * COLUMN_GAP), y: box.y, w, h: box.h },
    text: {
      kind: "text",
      lines: column,
      fontId: el.fontId,
      fontSizePt: best!.sizePt,
      align: "center",
      vAlign: "middle",
      anchor: "align",
      lineHeight: 1.15,
      colorHex: el.colorHex,
      letterSpacingMm: 0,
      overflowed: false,
    },
  }));
}

/** Each of `count` columns across `width`, the gutters between them taken out. */
function columnWidth(width: Mm, count: number): Mm {
  return (width - width * COLUMN_GAP * (count - 1)) / count;
}

/** Text fitted to a box with the element's face, or nothing when it is empty. */
function fitted(
  el: RoomElement,
  words: string,
  box: Box,
  sizePt: number,
  opts: Pick<ResolveOptions, "fitText">,
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
