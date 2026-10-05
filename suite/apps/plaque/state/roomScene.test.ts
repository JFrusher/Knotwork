import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { roomScene } from "./roomScene";

/** The example wedding, read through Seating's own geometry: what the board draws. */
const doc = migrate(JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8")));

test("every table of the plan, with its chairs in order and who sits in each", () => {
  const scene = roomScene(doc);
  expect(scene.tables).toHaveLength(14);
  const top = scene.tables.find((t) => t.label === "Top table")!;
  expect(top.seats.map((s) => s.number)).toEqual([...top.seats.keys()].map((i) => i + 1));
  expect(top.seats.some((s) => s.row?.["First Name"] === "Alex")).toBe(true);
  // Each sitter as their own card reads them: every column a card can use.
  expect(top.seats.find((s) => s.row)!.row).toHaveProperty("Place");
  // An empty table still has its chairs.
  expect(scene.tables.find((t) => t.label === "Table 13")!.seats.every((s) => s.row === null)).toBe(true);
  // The example's tables leave guests to sit where they like, as new tables do.
  expect(scene.tables.every((t) => !t.numbered)).toBe(true);
  expect(top.interior.w).toBeGreaterThan(0);
});

test("the walls and the bounds the room is drawn in", () => {
  const scene = roomScene(doc);
  expect(scene.walls.length).toBeGreaterThanOrEqual(4);
  expect(scene.bounds.w).toBeGreaterThan(0);
  for (const t of scene.tables) {
    expect(t.x).toBeGreaterThanOrEqual(scene.bounds.x);
    expect(t.x).toBeLessThanOrEqual(scene.bounds.x + scene.bounds.w);
  }
});

test("is read once per wedding", () => {
  expect(roomScene(doc)).toBe(roomScene(doc));
});
