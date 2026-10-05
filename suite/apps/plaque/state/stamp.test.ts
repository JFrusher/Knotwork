import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { usePlaque } = await import("./store");
const { initialSuite } = await import("./design");
const { noFit, resolveCard } = await import("../core/template/bindings");
const { makeResolveOptions } = await import("../core/template/resolve");
const { loadFont } = await import("../core/text/measure");
import { readFileSync } from "node:fs";
import type { RoomElement, TextElement } from "../core/types";

/*
 * Stamping a plan's names out as boxes of their own: bound to their chairs,
 * following the plan or staying where they are put.
 */
type Raw = Record<string, any>;
const plaque = () => usePlaque.getState();
const shared = () => useKnotworkStore.getState();

beforeEach(() => {
  const raw = {
    ...(emptyKnotwork() as unknown as Raw),
    guests: {
      g1: { id: "g1", firstName: "Charis", lastName: "Smith", assignedTableId: "t1" },
      g2: { id: "g2", firstName: "Eleanor", lastName: "Vane", assignedTableId: "t1" },
    },
    seating: {
      tables: {
        t1: { id: "t1", label: "Table 1", type: "round-8", capacity: 8, x: 300, y: 300, seatMode: "seat", assignedGuestIds: ["g1", "g2"] },
      },
    },
    stationery: { version: 3, savedAt: null, ...initialSuite() },
  };
  useKnotworkStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
  plaque().addPiece("Plan");
  plaque().addElement("room");
});

const plan = () => plaque().template.elements.find((el): el is RoomElement => el.kind === "room")!;
const boxes = () => plaque().template.elements.filter((el): el is TextElement => el.kind === "text" && Boolean(el.chair));
/** The card as it prints: where each named chair's box lands, by its text. */
const printed = () => {
  const { scene } = resolveCard(plaque().template, plaque().rows[0]!, plaque().card, {
    fitText: noFit,
    iconPath: () => null,
    room: () => plaque().room,
  });
  return Object.fromEntries(scene.elements.flatMap((el) => (el.kind === "text" && !el.sourceId ? [[el.lines.join(" "), { x: el.x, y: el.y }]] : [])));
};

describe("stamping a plan's names", () => {
  test("makes a box bound to each chair of a numbered table, and the plan stops naming them itself", () => {
    plaque().stampChairs(plan().id, true);
    expect(boxes().map((b) => b.template).slice(0, 2)).toEqual(["{{Table 1, seat 1}}", "{{Table 1, seat 2}}"]);
    expect(boxes()).toHaveLength(8);
    expect(plan().namesAtChairs).toBe(false);
    expect(Object.keys(printed())).toEqual(expect.arrayContaining(["Charis Smith", "Eleanor Vane"]));
  });

  test("boxes that follow move with the plan; a nudge stays a nudge", () => {
    plaque().stampChairs(plan().id, true);
    const before = printed()["Charis Smith"]!;
    const charis = boxes()[0]!;
    plaque().setElementBox(charis.id, { x: before.x + 5, y: before.y, w: charis.w, h: charis.h });
    expect(printed()["Charis Smith"]!.x).toBeCloseTo(before.x + 5);

    plaque().setElementBox(plan().id, { x: plan().x + 10, y: plan().y + 3, w: plan().w, h: plan().h });
    expect(printed()["Charis Smith"]!.x).toBeCloseTo(before.x + 15);
    expect(printed()["Charis Smith"]!.y).toBeCloseTo(before.y + 3);
  });

  test("boxes that stay are left where they were put when the plan moves", () => {
    plaque().stampChairs(plan().id, false);
    const before = printed()["Charis Smith"]!;
    plaque().setElementBox(plan().id, { x: plan().x + 10, y: plan().y, w: plan().w, h: plan().h });
    expect(printed()["Charis Smith"]).toEqual(before);
  });

  test("a box says whoever sits in its chair now", () => {
    plaque().stampChairs(plan().id, true);
    const seatOne = printed()["Charis Smith"]!;
    const seating = { tables: { t1: { ...(shared().raw.seating as Raw).tables.t1, assignedGuestIds: ["g2", "g1"] } } };
    shared().setSlice("seating", seating, { label: "the room" });
    expect(printed()["Eleanor Vane"]).toEqual(seatOne);
  });

  test("removing the plan leaves its boxes where they were, staying", () => {
    plaque().stampChairs(plan().id, true);
    const before = printed()["Charis Smith"]!;
    plaque().removeElement(plan().id);
    expect(boxes().every((b) => b.chair!.follow === false)).toBe(true);
    expect(printed()["Charis Smith"]).toEqual(before);
  });

  test("one chair at a time, and never twice", () => {
    plaque().stampChairs(plan().id, true, [{ table: "Table 1", seat: 2 }]);
    expect(boxes().map((b) => b.template)).toEqual(["{{Table 1, seat 2}}"]);
    plaque().stampChairs(plan().id, true);
    expect(boxes()).toHaveLength(8);
    expect(new Set(boxes().map((b) => b.template)).size).toBe(8);
  });

  test("on a table's own map, boxes always follow and say 'this card's table'", () => {
    plaque().updateElement(plan().id, { show: "table" } as never);
    plaque().stampChairs(plan().id, false);
    expect(boxes()[0]!.template).toBe("{{At seat 1}}");
    expect(boxes().every((b) => b.chair!.follow && b.chair!.table === null)).toBe(true);
  });

  test("the boxes say the names at the one size the plan drew them, not each as big as it can be", async () => {
    const crimson = loadFont("crimson", "Crimson Text", new Uint8Array(readFileSync("public/fonts/CrimsonText-Regular.ttf")));
    usePlaque.setState({ fonts: new Map([["crimson", crimson]]) });
    const long = { ...(shared().raw.guests as Raw), g2: { id: "g2", firstName: "Bartholomew", lastName: "Sorensen-Whitley", assignedTableId: "t1" } };
    shared().setSlice("guests", long, { label: "a guest" });
    const opts = makeResolveOptions(plaque().fonts, {}, new Map(), {}, plaque().room);
    const drawn = resolveCard(plaque().template, plaque().rows[0]!, plaque().card, opts).scene.elements.flatMap((el) =>
      el.kind === "text" && el.sourceId === plan().id && el.lines.join(" ") !== "Table 1" ? [el.fontSizePt] : [],
    );
    expect(drawn).toHaveLength(2);
    expect(drawn[0]).toBe(drawn[1]);
    expect(drawn[0]).toBeLessThan(plan().fontSizePt);

    plaque().stampChairs(plan().id, true);
    expect(new Set(boxes().map((b) => b.fontSizePt))).toEqual(new Set([drawn[0]]));
  });
});
