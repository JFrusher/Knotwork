import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/trousseau";
import type { Box } from "@/lib/model/types";
import { dayPlaces, find, neededAt, packing } from "./view";

const box = (patch: Partial<Box>): Box => ({ id: "b1", number: 1, name: "Getting ready", items: [], blockId: null, personIds: [], notes: "", ...patch });

const doc = migrate({
  timeline: {
    lanes: ["Main day"],
    blocks: [
      { id: "blk-prep", label: "Getting ready", durationMin: 180, anchorMin: 9 * 60, gapMin: 0, bufferMin: 0, lane: "Main day", tags: [], location: "The house", notes: "", outputs: [] },
    ],
  },
});

describe("where a box is needed, and by when", () => {
  it("is where its block is, by when its block starts", () => {
    expect(neededAt(box({ blockId: "blk-prep" }), dayPlaces(doc))).toEqual({
      place: { label: "Getting ready", location: "The house", startMin: 540 },
      lost: false,
    });
  });

  it("is nowhere for a box not for the day, and lost for one whose block has gone", () => {
    expect(neededAt(box({ blockId: null }), dayPlaces(doc))).toEqual({ place: null, lost: false });
    expect(neededAt(box({ blockId: "blk-gone" }), dayPlaces(doc))).toEqual({ place: null, lost: true });
  });
});

describe("finding things", () => {
  const boxes = {
    boxes: [
      box({ id: "b1", name: "Getting ready", items: [{ id: "i1", label: "Shoes", quantity: 2, packed: true }] }),
      box({ id: "b2", number: 2, name: "Overnight", items: [{ id: "i2", label: "Spare shoes for dancing", quantity: 1, packed: false }] }),
    ],
  };

  it("finds every box a thing is in, whatever the case", () => {
    expect(find(boxes, "SHOES").map((found) => `${found.box.number}: ${found.item?.label}`)).toEqual(["1: Shoes", "2: Spare shoes for dancing"]);
  });

  it("wants every word, and finds a box by its own name", () => {
    expect(find(boxes, "dancing shoes").map((found) => found.item?.label)).toEqual(["Spare shoes for dancing"]);
    expect(find(boxes, "overnight")).toEqual([{ box: boxes.boxes[1], item: null }]);
    expect(find(boxes, "   ")).toEqual([]);
  });

  it("counts packing by the line, not by how many of each", () => {
    expect(packing({ items: [...boxes.boxes[0]!.items, ...boxes.boxes[1]!.items] })).toEqual({ packed: 1, total: 2 });
  });
});
