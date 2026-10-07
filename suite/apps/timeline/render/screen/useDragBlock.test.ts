// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { sampleDoc } from "../../core/model/defaults";
import { currentDoc, useStore } from "../../state/store";
import { openDay } from "../../state/testing";
import { minutesFromDelta, SNAP_MIN } from "./useDragBlock";

describe("minutesFromDelta", () => {
  it("converts pixels dragged down the page to minutes", () => {
    // Down the page is later, so a positive delta is a later time.
    expect(minutesFromDelta(60, 1)).toBe(60);
    expect(minutesFromDelta(60, 2)).toBe(30);
    expect(minutesFromDelta(-60, 2)).toBe(-30);
  });

  it("snaps to five minute marks", () => {
    expect(minutesFromDelta(7, 1)).toBe(5);
    expect(minutesFromDelta(13, 1)).toBe(15);
    expect(minutesFromDelta(2, 1)).toBe(0);
    expect(minutesFromDelta(1000, 1) % SNAP_MIN).toBe(0);
  });

  it("does not divide by a zoom of zero", () => {
    expect(minutesFromDelta(100, 0)).toBe(0);
  });
});

describe("drag through the store", () => {
  beforeEach(() => {
    openDay(sampleDoc());
  });

  it("previews without changing the document, and cancels clean", () => {
    const before = currentDoc();
    useStore.getState().previewChange({ type: "shift", blockId: "blk-ceremony", deltaMin: 20 });
    expect(useStore.getState().preview?.movedIds).toContain("blk-confetti");
    expect(currentDoc()).toBe(before);

    useStore.getState().cancelPreview();
    expect(currentDoc()).toBe(before);
    expect(useKnotworkStore.getState().past).toEqual([]);
  });

  it("commits one undoable edit when the drag ends", () => {
    useStore.getState().previewChange({ type: "shift", blockId: "blk-ceremony", deltaMin: 20 });
    useStore.getState().commitPreview();
    expect(currentDoc().blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(830);
    expect(useKnotworkStore.getState().past.at(-1)?.label).toBe("moving a block");
    useKnotworkStore.getState().undo();
    expect(currentDoc().blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(810);
  });

  it("moves a block to a later time when dragged downward", () => {
    const downward = minutesFromDelta(26, 1.3);
    useStore.getState().previewChange({ type: "shift", blockId: "blk-ceremony", deltaMin: downward });
    useStore.getState().commitPreview();
    expect(currentDoc().blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(830);
  });
});
