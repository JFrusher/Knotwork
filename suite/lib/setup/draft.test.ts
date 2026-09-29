import { expect, test } from "vitest";
import { readSeating } from "@/lib/model/slices";
import { emptyTrousseau, migrate } from "@jfrusher/trousseau";
import { startingRoom, tablesFor, withPasted } from "./draft";

test("enough tables for everyone", () => {
  expect(tablesFor(100, "round")).toBe(13);
  expect(tablesFor(100, "banquet")).toBe(7);
  expect(tablesFor(0, "round")).toBe(1);
});

test("a starting room is Seating's own tables, in rows that do not overlap", () => {
  const seating = startingRoom({}, "round", 13);
  const tables = Object.values(readSeating(migrate({ ...emptyTrousseau(), seating })).tables);
  expect(tables).toHaveLength(13);
  expect(tables.map((t) => t.label)).toContain("Table 13");
  expect(tables.every((t) => t.type === "round" && t.capacity === 8 && t.sizeUnits)).toBe(true);
  const spots = new Set(tables.map((t) => `${t.x},${t.y}`));
  expect(spots.size).toBe(13);
});

test("a room of many tables grows to hold them", () => {
  const seating = startingRoom({}, "round", 40);
  expect((seating["room"] as { height: number }).height).toBeGreaterThan(900);
});

test("pasted names become guests, and a name already on the list is not added twice", () => {
  const once = withPasted("Ann Lee\nBo Chen\n\n", {}, {});
  expect(Object.values(once).map((g) => (g as { firstName: string }).firstName).sort()).toEqual(["Ann", "Bo"]);
  const twice = withPasted("Ann Lee\nCy Dent", once as never, {});
  expect(Object.keys(twice)).toHaveLength(3);
});
