import { describe, expect, it } from "vitest";
import { emptyBoxes } from "@/lib/model/slices";
import type { Boxes } from "@/lib/model/types";
import { addBox, addItem, moveItem, patchItem, removeBox, USUAL_BOXES, withUsualBoxes } from "./actions";

const two = (): Boxes => {
  const first = addBox(emptyBoxes(), { name: "Getting ready" });
  const withShoes = addItem(first, first.boxes[0]!.id, "Shoes", 2);
  return addBox(withShoes, { name: "Overnight" });
};

describe("boxes", () => {
  it("numbers a new box on from the highest, not from how many there are", () => {
    const boxes = two();
    expect(boxes.boxes.map((box) => box.number)).toEqual([1, 2]);
    const gap = addBox(removeBox(boxes, boxes.boxes[0]!.id));
    expect(gap.boxes.map((box) => box.number)).toEqual([2, 3]);
  });

  it("adds what is packed, and adds nothing for an empty line", () => {
    const boxes = two();
    expect(boxes.boxes[0]!.items).toEqual([{ id: expect.any(String), label: "Shoes", quantity: 2, packed: false }]);
    expect(addItem(boxes, boxes.boxes[0]!.id, "   ")).toBe(boxes);
  });

  it("moves an item to another box, packed as it was, and leaves it where it is otherwise", () => {
    const boxes = two();
    const [ready, overnight] = boxes.boxes;
    const shoes = ready!.items[0]!;
    const packed = patchItem(boxes, ready!.id, shoes.id, { packed: true });
    const moved = moveItem(packed, shoes.id, overnight!.id);
    expect(moved.boxes[0]!.items).toEqual([]);
    expect(moved.boxes[1]!.items).toEqual([{ ...shoes, packed: true }]);
    expect(moveItem(packed, shoes.id, ready!.id)).toBe(packed);
    expect(moveItem(packed, "no-such-item", overnight!.id)).toBe(packed);
  });
});

describe("the usual boxes", () => {
  it("adds the usual boxes with what goes in them, numbered on from any already there", () => {
    const boxes = withUsualBoxes(addBox(emptyBoxes(), { name: "Flowers" }));
    expect(boxes.boxes.map((box) => `${box.number} ${box.name}`)).toEqual([
      "1 Flowers",
      ...USUAL_BOXES.map((usual, index) => `${index + 2} ${usual.name}`),
    ]);
    expect(boxes.boxes[1]!.items.map((item) => item.label)).toContain("The rings");
    expect(boxes.boxes.flatMap((box) => box.items).every((item) => !item.packed)).toBe(true);
  });

  it("never doubles up, matching by name", () => {
    const once = withUsualBoxes(emptyBoxes());
    expect(withUsualBoxes(once)).toBe(once);
  });
});
