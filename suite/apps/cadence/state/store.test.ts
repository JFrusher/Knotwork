import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { emptyDoc, sampleDoc } from "../core/model/defaults";
import { currentDoc, scheduleComputeCount, scheduleFor, useStore, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./store";
import { openDay } from "./testing";

function state() {
  return useStore.getState();
}
const doc = currentDoc;
const schedule = () => scheduleFor(currentDoc());
// Timeline's undo is the wedding's.
const history = () => useKnotworkStore.getState();

beforeEach(() => {
  openDay(sampleDoc());
});
afterEach(() => {
  vi.useRealTimers();
});

describe("schedule selector", () => {
  it("computes once for repeated reads of the same document", () => {
    const before = scheduleComputeCount();
    schedule();
    schedule();
    scheduleFor(doc());
    expect(scheduleComputeCount()).toBe(before + 1);
  });

  it("recomputes after an edit", () => {
    schedule();
    const before = scheduleComputeCount();
    state().updateBlock("blk-cake", { durationMin: 25 });
    schedule();
    expect(scheduleComputeCount()).toBe(before + 1);
  });

  it("carries the conflicts, slack and sun for the day", () => {
    const day = schedule();
    expect(day.conflicts).toEqual([]);
    expect(day.slack.toCurfewMin).toBe(0);
    expect(day.sun?.sunsetMin).toBeGreaterThan(20 * 60);
    expect(day.positions.get("blk-ceremony")?.startMin).toBe(810);
  });
});

describe("document actions", () => {
  it("adds a block at the end of its own lane and selects it", () => {
    const before = doc();
    const id = state().addBlock("Suppliers", { label: "Cake delivery" });
    expect(state().selectedId).toBe(id);
    const blocks = doc().blocks;
    const added = blocks.findIndex((block) => block.id === id);
    expect(blocks[added]?.lane).toBe("Suppliers");
    expect(blocks[added + 1]?.lane).toBe("Transport");
    expect(before.blocks).not.toContainEqual(expect.objectContaining({ id }));
  });

  it("updates a block without touching the previous document", () => {
    const before = doc();
    state().updateBlock("blk-ceremony", { label: "Ceremony (civil)" });
    expect(doc().blocks.find((b) => b.id === "blk-ceremony")?.label).toBe("Ceremony (civil)");
    expect(before.blocks.find((b) => b.id === "blk-ceremony")?.label).toBe("Ceremony");
  });

  it("deletes a block and clears the selection", () => {
    state().select("blk-cake");
    state().deleteBlock("blk-cake");
    expect(doc().blocks.some((b) => b.id === "blk-cake")).toBe(false);
    expect(state().selectedId).toBeNull();
  });

  it("reorders within a lane, stepping over blocks in other lanes", () => {
    const before = doc().blocks.filter((b) => b.lane === "Main day").map((b) => b.id);
    const at = before.indexOf("blk-confetti");
    state().reorderBlock("blk-confetti", 1);
    const after = doc().blocks.filter((b) => b.lane === "Main day").map((b) => b.id);
    expect(after[at]).toBe(before[at + 1]);
    expect(after[at + 1]).toBe("blk-confetti");
  });

  it("does nothing reordering past the end of a lane", () => {
    const before = doc();
    state().reorderBlock("blk-carriages", 1);
    expect(doc()).toBe(before);
  });

  it("pins an anchor where the block already sits", () => {
    expect(doc().blocks.find((b) => b.id === "blk-confetti")?.anchorMin).toBeNull();
    state().toggleAnchor("blk-confetti");
    // Confetti resolves to 14:15 in the sample day; it must not jump.
    expect(doc().blocks.find((b) => b.id === "blk-confetti")?.anchorMin).toBe(855);
  });

  it("returns an anchored block to floating with its gap preserved", () => {
    state().updateBlock("blk-ceremony", { gapMin: 5 });
    state().toggleAnchor("blk-ceremony");
    const block = doc().blocks.find((b) => b.id === "blk-ceremony");
    expect(block?.anchorMin).toBeNull();
    expect(block?.gapMin).toBe(5);
  });

  it("edits the day, tag details and styles", () => {
    state().setDay({ curfewMin: 1440 });
    expect(doc().day.curfewMin).toBe(1440);

    state().setTagDetail({ tag: "cake", phone: "07700 900999" });
    expect(doc().tagDetails.find((d) => d.tag === "cake")?.phone).toBe("07700 900999");
    state().setTagDetail({ tag: "cake", phone: "07700 900000" });
    expect(doc().tagDetails.filter((d) => d.tag === "cake")).toHaveLength(1);
    state().removeTagDetail("cake");
    expect(doc().tagDetails.some((d) => d.tag === "cake")).toBe(false);

    state().setStyle("run-sheet", { fontFamily: "Marcellus" });
    expect(doc().styles["run-sheet"].fontFamily).toBe("Marcellus");
    expect(doc().styles["order-of-day"].fontFamily).toBe("Crimson Text");
  });

  it("sets a journey's time, changes it from either end, and takes it away", () => {
    state().setJourney(["The suite", "Orangery"], 5);
    expect(doc().travel).toEqual([{ between: ["The suite", "Orangery"], minutes: 5 }]);
    expect(history().past.at(-1)?.label).toBe("a journey's time");

    state().setJourney(["orangery", "the suite"], 8);
    expect(doc().travel).toEqual([{ between: ["The suite", "Orangery"], minutes: 8 }]);

    state().setJourney(["Orangery", "The suite"], null);
    expect(doc().travel).toEqual([]);
  });

  it("puts nothing on the history for taking away a journey nobody typed", () => {
    const before = doc();
    const steps = history().past.length;
    state().setJourney(["The suite", "Lawn"], null);
    expect(doc()).toBe(before);
    expect(history().past).toHaveLength(steps);
  });

  it("adds a lane once", () => {
    state().addLane("Children");
    state().addLane("Children");
    state().addLane("  Children  ");
    state().addLane("   ");
    expect(doc().lanes.filter((lane) => lane === "Children")).toHaveLength(1);
    expect(doc().lanes).not.toContain("");
  });

  it("renames a lane and every block standing in it", () => {
    state().renameLane("Suppliers", "Vendors");
    expect(doc().lanes).toContain("Vendors");
    expect(doc().lanes).not.toContain("Suppliers");
    expect(doc().blocks.filter((block) => block.lane === "Suppliers")).toHaveLength(0);
    expect(doc().blocks.some((block) => block.lane === "Vendors")).toBe(true);
  });

  it("refuses a rename onto a lane that already exists", () => {
    const before = doc();
    state().renameLane("Suppliers", "Transport");
    expect(doc()).toBe(before);
  });

  it("deletes an empty lane and refuses one that still holds blocks", () => {
    state().addLane("Children");
    state().deleteLane("Children");
    expect(doc().lanes).not.toContain("Children");

    const before = doc();
    state().deleteLane("Main day");
    expect(doc()).toBe(before);
    expect(state().notice).toContain("Main day");
  });
});

describe("undo and redo", () => {
  it("walks back and forward through edits made a moment apart", () => {
    vi.useFakeTimers();
    state().updateBlock("blk-ceremony", { label: "One" });
    vi.advanceTimersByTime(1000);
    state().updateBlock("blk-ceremony", { label: "Two" });
    history().undo();
    expect(doc().blocks.find((b) => b.id === "blk-ceremony")?.label).toBe("One");
    history().redo();
    expect(doc().blocks.find((b) => b.id === "blk-ceremony")?.label).toBe("Two");
  });

  it("takes a label typed in quick keystrokes back in one step", () => {
    state().updateBlock("blk-ceremony", { label: "C" });
    state().updateBlock("blk-ceremony", { label: "Ci" });
    state().updateBlock("blk-ceremony", { label: "Civil" });
    history().undo();
    expect(doc().blocks.find((b) => b.id === "blk-ceremony")?.label).toBe("Ceremony");
  });

  it("puts no step on the history for an edit that changes nothing", () => {
    state().reorderBlock("blk-carriages", 1);
    state().addLane("Main day");
    expect(history().past).toEqual([]);
  });

  it("opens an empty day with nothing to undo", () => {
    openDay(emptyDoc());
    expect(history().past).toEqual([]);
    expect(doc().blocks).toEqual([]);
  });
});

describe("what-if preview", () => {
  it("does not change the document until it is committed", () => {
    const before = doc();
    state().previewChange({ type: "shift", blockId: "blk-ceremony", deltaMin: 20 });
    expect(state().preview?.movedIds).toContain("blk-confetti");
    expect(doc()).toBe(before);

    state().cancelPreview();
    expect(state().preview).toBeNull();
    expect(doc()).toBe(before);
    expect(history().past).toEqual([]);
  });

  it("commits the previewed document as one undoable edit", () => {
    state().previewChange({ type: "shift", blockId: "blk-ceremony", deltaMin: 20 });
    state().commitPreview();
    expect(doc().blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(830);
    expect(state().preview).toBeNull();
    history().undo();
    expect(doc().blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(810);
  });
});

describe("zoom", () => {
  it("opens at a scale that shows a half hour as a readable box", () => {
    expect(useStore.getState().ui.pxPerMin).toBe(1.3);
  });

  it("steps by a ratio, not a fixed amount", () => {
    const before = useStore.getState().ui.pxPerMin;
    useStore.getState().zoomBy(ZOOM_STEP);
    expect(useStore.getState().ui.pxPerMin).toBeCloseTo(before * ZOOM_STEP, 5);
  });

  it("stays inside the range however hard it is pushed", () => {
    for (let i = 0; i < 40; i += 1) useStore.getState().zoomBy(ZOOM_STEP);
    expect(useStore.getState().ui.pxPerMin).toBe(ZOOM_MAX);
    for (let i = 0; i < 40; i += 1) useStore.getState().zoomBy(1 / ZOOM_STEP);
    expect(useStore.getState().ui.pxPerMin).toBe(ZOOM_MIN);
  });

  it("fits the day to the viewport it is given", () => {
    useStore.getState().fitDay(1000, 500);
    expect(useStore.getState().ui.pxPerMin).toBe(2);
  });

  it("will not fit a day into no room at all", () => {
    const before = useStore.getState().ui.pxPerMin;
    useStore.getState().fitDay(0, 500);
    useStore.getState().fitDay(1000, 0);
    expect(useStore.getState().ui.pxPerMin).toBe(before);
  });

  it("does not put zoom in the undo history", () => {
    useStore.getState().zoomBy(ZOOM_STEP);
    expect(history().past).toEqual([]);
  });
});
