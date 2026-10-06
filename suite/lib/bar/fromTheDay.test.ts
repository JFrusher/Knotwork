import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { withTool } from "@/lib/model/toolbox";
import { readBar } from "@/lib/model/slices";
import { setSpan } from "./actions";
import { barSum, sumBar } from "./sum";
import { hoursFromTheDay } from "./fromTheDay";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const withBar = (r: Record<string, unknown>, bar: unknown) => migrate({ ...r, bar });
const picked = (r = raw) => setSpan(readBar(migrate(r)), "reception", { from: "blk-drinks", to: "blk-drinks" });

describe("the Bar's hours, read from the Timeline", () => {
  it("are the picked block's own length: the example's drinks reception is 1h 15m", () => {
    const doc = withBar(raw, picked());
    expect(hoursFromTheDay(doc).reception).toEqual({ hours: 1.25, lost: false, outOfOrder: false });
    const listed = barSum(migrate(raw)).heads.listed;
    expect(barSum(doc).each).toEqual(sumBar({ ...readBar(doc), figures: { ...readBar(doc).figures, receptionHours: 1.25 } }, listed).each);
  });

  it("run from the first block's start to the last one's end", () => {
    const bar = setSpan(readBar(migrate(raw)), "evening", { from: "blk-firstdance", to: "blk-lastdance" });
    // 20:30 to 00:40.
    expect(hoursFromTheDay(withBar(raw, bar)).evening.hours).toBeCloseTo(250 / 60, 6);
  });

  it("follow the block when it is resized on the Timeline, with no edit in the Bar", () => {
    const blocks = raw.timeline.blocks.map((b: { id: string }) => (b.id === "blk-drinks" ? { ...b, durationMin: 120 } : b));
    const longer = { ...raw, timeline: { ...raw.timeline, blocks } };
    expect(hoursFromTheDay(withBar(longer, picked())).reception.hours).toBe(2);
  });

  it("say so when a picked block is gone, and the typed hours are used", () => {
    const blocks = raw.timeline.blocks.filter((b: { id: string }) => b.id !== "blk-drinks");
    const gone = { ...raw, timeline: { ...raw.timeline, blocks } };
    const doc = withBar(gone, picked());
    expect(hoursFromTheDay(doc).reception).toEqual({ hours: null, lost: true, outOfOrder: false });
    expect(barSum(doc).each.reception).toBe(sumBar(readBar(doc), barSum(doc).heads.listed).each.reception);
  });

  it("are the typed hours while the Timeline is hidden", () => {
    const hidden = { ...raw, tools: withTool(raw, "timeline", false) };
    const doc = withBar(hidden, picked(hidden));
    expect(hoursFromTheDay(doc).reception).toEqual({ hours: null, lost: false, outOfOrder: false });
  });
});

describe("a span whose blocks have changed order", () => {
  it("uses the typed hours, and says why, rather than counting no hours at all", () => {
    // The evening picked from first dance to last dance, then the last dance moved before it.
    const blocks = raw.timeline.blocks.map((b: { id: string }) => (b.id === "blk-lastdance" ? { ...b, anchorMin: 1200 } : b));
    const moved = { ...raw, timeline: { ...raw.timeline, blocks } };
    const bar = setSpan(readBar(migrate(moved)), "evening", { from: "blk-firstdance", to: "blk-lastdance" });
    const doc = withBar(moved, bar);
    expect(hoursFromTheDay(doc).evening).toEqual({ hours: null, lost: false, outOfOrder: true });
    expect(barSum(doc).each.evening).toBe(sumBar(readBar(doc), barSum(doc).heads.listed).each.evening);
  });
});
