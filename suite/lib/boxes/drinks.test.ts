// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { readBar, readBoxes } from "@/lib/model/slices";
import { barSum } from "@/lib/bar/sum";
import { shoppingList } from "@/lib/bar/rows";
import { drinksChanged, withDrinks } from "./drinks";

type Raw = Record<string, any>;
const raw: Raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
// The reception is the first part of the day the Bar pours for.
const withSpans: Raw = { ...raw, bar: { ...raw.bar, spans: { reception: { from: "blk-drinks", to: "blk-drinks" } } } };

describe("the drinks as a box", () => {
  const doc = migrate(withSpans);
  const boxes = withDrinks(readBoxes(doc), doc);
  const drinks = boxes.boxes.find((box) => box.name === "Drinks")!;

  it("is one box with a line for each thing on the Bar's shopping list, for the block the Bar starts at", () => {
    const words = shoppingList(readBar(doc), barSum(doc)).flatMap((group) =>
      group.rows.map((row) => [`${row.name}: ${row.amount}`, row.cases].filter(Boolean).join(", ")),
    );
    expect(words[0]).toMatch(/^Fizz: \d+ bottles, \d+ cases of 6$/);
    expect(drinks.items.map((item) => item.label)).toEqual(words);
    expect(drinks.items.every((item) => !item.packed)).toBe(true);
    expect(drinks.blockId).toBe("blk-drinks");
    expect(boxes.boxes).toHaveLength(readBoxes(doc).boxes.length + 1);
  });

  it("is added once", () => {
    expect(withDrinks(boxes, doc)).toBe(boxes);
  });

  it("says when the Bar's list has changed since, and not before", () => {
    expect(drinksChanged(drinks, doc)).toBe(false);
    const fewer = migrate({ ...withSpans, bar: { ...withSpans.bar, people: 40 } });
    expect(drinksChanged(drinks, fewer)).toBe(true);
  });
});
