import { newId } from "@/lib/model/ids";
import type { Box, BoxItem, Boxes } from "@/lib/model/types";

/**
 * The boxes, edited: boxes in the order they were made, each numbered for its
 * label, and what is in each. Every edit hands back the same boxes when it
 * changes nothing, so no empty step lands on the history.
 */

const nextNumber = (boxes: Boxes) => boxes.boxes.reduce((highest, box) => Math.max(highest, box.number), 0) + 1;

export function addBox(boxes: Boxes, patch: Partial<Omit<Box, "id" | "number">> = {}): Boxes {
  const box: Box = { id: newId("box"), number: nextNumber(boxes), name: "", items: [], blockId: null, personIds: [], notes: "", ...patch };
  return { ...boxes, boxes: [...boxes.boxes, box] };
}

export function patchBox(boxes: Boxes, boxId: string, patch: Partial<Omit<Box, "id" | "items">>): Boxes {
  return { ...boxes, boxes: boxes.boxes.map((box) => (box.id === boxId ? { ...box, ...patch } : box)) };
}

export function removeBox(boxes: Boxes, boxId: string): Boxes {
  return { ...boxes, boxes: boxes.boxes.filter((box) => box.id !== boxId) };
}

function withItems(boxes: Boxes, boxId: string, change: (items: BoxItem[]) => BoxItem[]): Boxes {
  return { ...boxes, boxes: boxes.boxes.map((box) => (box.id === boxId ? { ...box, items: change(box.items) } : box)) };
}

export function addItem(boxes: Boxes, boxId: string, label: string, quantity = 1): Boxes {
  const clean = label.trim();
  if (!clean) return boxes;
  return withItems(boxes, boxId, (items) => [...items, { id: newId("item"), label: clean, quantity, packed: false }]);
}

export function patchItem(boxes: Boxes, boxId: string, itemId: string, patch: Partial<Omit<BoxItem, "id">>): Boxes {
  return withItems(boxes, boxId, (items) => items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
}

export function removeItem(boxes: Boxes, boxId: string, itemId: string): Boxes {
  return withItems(boxes, boxId, (items) => items.filter((item) => item.id !== itemId));
}

/** An item into another box, at the end of what is in it, packed or not as it was. */
export function moveItem(boxes: Boxes, itemId: string, toBoxId: string): Boxes {
  const from = boxes.boxes.find((box) => box.items.some((item) => item.id === itemId));
  const item = from?.items.find((candidate) => candidate.id === itemId);
  if (!from || !item || from.id === toBoxId || !boxes.boxes.some((box) => box.id === toBoxId)) return boxes;
  return withItems(removeItem(boxes, from.id, itemId), toBoxId, (items) => [...items, item]);
}

/**
 * The boxes most weddings pack, UK first: a list to change, not a rule. What
 * the ceremony needs on paper depends on the ceremony, so it is asked about
 * rather than named.
 */
export const USUAL_BOXES: ReadonlyArray<{ name: string; items: string[] }> = [
  {
    name: "The rings and the paperwork",
    items: ["The rings", "Any paperwork the ceremony needs", "Vows and readings", "Envelopes for suppliers' final payments", "Thank-you cards for suppliers"],
  },
  {
    name: "Getting ready",
    items: ["Outfits, on hangers", "Shoes", "Steamer", "Emergency kit: plasters, safety pins, needle and thread, painkillers", "Phone chargers", "Snacks and water"],
  },
  {
    name: "The day's odds and ends",
    items: ["Guest book and pens", "Table plan", "Place cards", "Signs", "Card box", "Cake knife", "Favours"],
  },
  {
    name: "Overnight and the day after",
    items: ["Clothes for the day after", "Toiletries", "Medication", "Passports and travel documents"],
  },
];

/** The usual boxes this wedding does not have yet, matched by name, so it can be asked for twice. */
export function withUsualBoxes(boxes: Boxes): Boxes {
  const have = new Set(boxes.boxes.map((box) => box.name.trim().toLowerCase()));
  return USUAL_BOXES.filter((usual) => !have.has(usual.name.toLowerCase())).reduce((next, usual) => {
    const added = addBox(next, { name: usual.name });
    const box = added.boxes[added.boxes.length - 1]!;
    return usual.items.reduce((withItem, label) => addItem(withItem, box.id, label), added);
  }, boxes);
}
