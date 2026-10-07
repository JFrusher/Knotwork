import type { Knotwork } from "@jfrusher/knotwork";
import { cached } from "@/lib/model/slices";
import { planFrom } from "@/apps/seating/store/plan";
import { getWallSegs, layoutFloorPlan } from "@/apps/seating/utils/floorPlanSvg";
import { SEAT_RADIUS, type TableGeometry } from "@/apps/seating/utils/seatPositions";
import { getTableInterior } from "@/apps/seating/utils/tableGrid";
import type { GuestRow } from "../core/data/rows";
import type { RoomScene, RoomTable } from "../core/types";
import { roomRows } from "./fromRoom";

/**
 * The seating plan as a room element draws it, once per document.
 *
 * Read through Seating's own geometry pass — the one its editor, its printed
 * chart and the guest link's plan all use — so a table on the board is where it
 * is on the screen, chairs and all. Core gets plain numbers and knows nothing of
 * Seating.
 */
export function roomScene(doc: Knotwork): RoomScene {
  return cached(doc, "stationery.roomScene", () => build(doc));
}

function build(doc: Knotwork): RoomScene {
  const layout = layoutFloorPlan(planFrom({ guests: doc.guests, seating: doc.seating }, doc.event));
  // Each sitter as their own card reads them, so a chair can be named with any
  // token a card can use.
  const room = roomRows(doc);
  const rowOf = new Map<string, GuestRow>(room.rowIds.map((id, i) => [id, room.rows[i]!]));

  const tables: RoomTable[] = layout.geoms.map(({ t, g }) => ({
    label: t.label,
    x: t.x,
    y: t.y,
    rotationDeg: t.rotation || 0,
    ...outline(g),
    numbered: t.seatMode === "seat",
    interior: interiorOf(g),
    seats: layout.seats
      .filter((seat) => seat.table.id === t.id)
      .sort((a, b) => a.index - b.index)
      .map((seat) => ({
        x: seat.x,
        y: seat.y,
        out: { x: seat.nx, y: seat.ny },
        number: seat.index + 1,
        row: (seat.guest && rowOf.get(seat.guest.id)) ?? null,
      })),
  }));

  return {
    bounds: { x: layout.minX, y: layout.minY, w: layout.width, h: layout.height },
    walls: layout.spaces.flatMap(getWallSegs).map((wall) => [
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
    ]),
    seatRadius: SEAT_RADIUS,
    tables,
  };
}

/** The largest box inside a table, about its own centre: where a free-seating table's names go. */
function interiorOf(g: TableGeometry): RoomTable["interior"] {
  const inside = getTableInterior(g);
  return { x: -inside.width / 2, y: inside.offsetY - inside.height / 2, w: inside.width, h: inside.height };
}

/** A table's shape as a path about its own centre, and the box that path fills. */
function outline(g: TableGeometry): Pick<RoomTable, "pathD" | "view"> {
  const r = g.radius;
  if (g.shape === "circle") {
    return {
      pathD: `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`,
      view: { x: -r, y: -r, w: r * 2, h: r * 2 },
    };
  }
  if (g.shape === "half-circle") {
    const cy = g.cy ?? r / 2;
    return {
      pathD: `M ${-r} ${cy} A ${r} ${r} 0 0 1 ${r} ${cy} Z`,
      view: { x: -r, y: cy - r, w: r * 2, h: r },
    };
  }
  const w = g.width / 2;
  const h = g.height / 2;
  return {
    pathD: `M ${-w} ${-h} H ${w} V ${h} H ${-w} Z`,
    view: { x: -w, y: -h, w: g.width, h: g.height },
  };
}
