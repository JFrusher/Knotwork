import type { Knotwork } from "@jfrusher/knotwork";
import { buyWords } from "@/lib/bar/rows";
import { barSum } from "@/lib/bar/sum";
import { readBar } from "@/lib/model/slices";
import type { Box, Boxes } from "@/lib/model/types";
import { addBox, addItem } from "./actions";

/**
 * The Bar's shopping list as a box, made once on request and Boxes' own from
 * then on: the couple ticks it packed and names who takes it. It keeps no tie
 * to the Bar beyond its name, so the Bar changing is said, never applied.
 */

export const DRINKS = "Drinks";

/** "Fizz: 42 bottles, 7 cases of 6", a line for each thing there is some to buy of. */
export function drinksLines(doc: Knotwork): string[] {
  const bar = readBar(doc);
  return barSum(doc)
    .lines.filter((line) => line.buy > 0)
    .map((line) => {
      const { amount, cases } = buyWords(bar, line);
      return [`${line.name}: ${amount}`, cases].filter(Boolean).join(", ");
    });
}

/** The box, for the first part of the day the Bar pours for; the same boxes when there is one already. */
export function withDrinks(boxes: Boxes, doc: Knotwork): Boxes {
  if (boxes.boxes.some((box) => box.name.trim().toLowerCase() === DRINKS.toLowerCase())) return boxes;
  const { spans } = readBar(doc);
  const added = addBox(boxes, { name: DRINKS, blockId: spans.reception?.from ?? spans.evening?.from ?? null });
  const box = added.boxes[added.boxes.length - 1]!;
  return drinksLines(doc).reduce((next, label) => addItem(next, box.id, label), added);
}

/** Whether the Bar's list now says something other than what is in the box. */
export function drinksChanged(box: Box, doc: Knotwork): boolean {
  const now = drinksLines(doc);
  return now.length !== box.items.length || now.some((label, i) => box.items[i]!.label !== label);
}
