import { toCsv } from "@/lib/data/csv";
import { personName } from "@/lib/model/slices";
import type { BoxItem, Boxes, Crew, Guest } from "@/lib/model/types";
import type { Place } from "@/lib/model/slices";
import { neededAt, whereBy } from "./view";

/** One box as it is printed: the labels, the list and the CSV are made from these, so they agree. */
export interface BoxRow {
  number: number;
  name: string;
  /** "The suite, by 08:00", "Not for the day". */
  where: string;
  lost: boolean;
  takenBy: string[];
  items: BoxItem[];
}

export function boxRows(boxes: Boxes, places: ReadonlyMap<string, Place>, crew: Crew, guests: Record<string, Guest>): BoxRow[] {
  const people = new Map(crew.people.map((person) => [person.id, person]));
  return [...boxes.boxes]
    .sort((a, b) => a.number - b.number)
    .map((box) => {
      const { place, lost } = neededAt(box, places);
      return {
        number: box.number,
        name: box.name.trim() || "A box with no name",
        where: whereBy(place, lost),
        lost,
        takenBy: box.personIds.map((id) => {
          const person = people.get(id);
          return person ? personName(person, guests) : "Someone no longer in the crew";
        }),
        items: box.items,
      };
    });
}

/** "2 × Shoes", or just "Shoes". */
export const itemText = (item: Pick<BoxItem, "label" | "quantity">) =>
  item.quantity > 1 ? `${item.quantity} × ${item.label}` : item.label;

/** Every thing in every box, one to a row, for a spreadsheet. */
export function boxesCsv(rows: BoxRow[]): string {
  return toCsv(
    ["Box", "Name", "Needed", "Taken by", "Item", "How many", "Packed"],
    rows.flatMap((row) =>
      (row.items.length > 0 ? row.items : [null]).map((item) => [
        String(row.number),
        row.name,
        row.where,
        row.takenBy.join(", "),
        item?.label ?? "",
        item ? String(item.quantity) : "",
        item ? (item.packed ? "Yes" : "No") : "",
      ]),
    ),
  );
}
