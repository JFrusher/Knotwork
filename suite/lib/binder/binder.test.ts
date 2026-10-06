// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { formatClock } from "@/lib/minutes";
import { withTool } from "@/lib/model/toolbox";
import { contacts, dayClock, findBoxes, findGuests, nowAndNext, runningOrder, walkingOrder } from "./binder";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const doc = migrate(raw);
const blocks = runningOrder(doc);

describe("the day, in a pocket", () => {
  it("keeps the running order soonest first", () => {
    expect(blocks).toHaveLength(27);
    expect(blocks[0]).toMatchObject({ label: "Florist install", startMin: 420 });
  });

  it("reads the venue's clock, whatever the phone's own time zone", () => {
    // 12:45 UTC is 13:45 at the venue, an hour ahead in June.
    const clock = dayClock(doc, blocks, Date.parse("2028-06-01T12:45:00Z"));
    expect(clock).toEqual({ phase: "on", minute: 825, daysAway: 0 });
    const { now, next } = nowAndNext(blocks, clock.minute);
    expect(now.map((block) => block.label)).toEqual(["Ceremony"]);
    expect(next.map((block) => block.label)).toEqual(["Confetti", "Drinks reception", "Group photographs"]);
  });

  it("says how far off the day is before it, and that it is over after", () => {
    expect(dayClock(doc, blocks, Date.parse("2028-05-31T12:00:00Z"))).toMatchObject({ phase: "before", daysAway: 1 });
    expect(dayClock(doc, blocks, Date.parse("2028-06-02T02:00:00Z")).phase).toBe("after");
  });

  it("lists everyone there is a number for, once each", () => {
    const found = contacts(doc);
    expect(found).toHaveLength(6);
    expect(found[0]).toEqual({ name: "Eleanor Vane Photography", role: "photographer", phone: "07700 900141" });
  });

  it("finds a guest who is coming, and where they sit", () => {
    const found = findGuests(doc, "zainab");
    expect(found.map((guest) => guest.name)).toEqual(["Zainab Lindqvist", "Zainab Raghunathan", "Zainab Thistlewood"]);
    expect(found[2]!.table).toBe("No table yet");
    expect(findGuests(doc, "zainab lind")).toHaveLength(1);
  });
});

describe("finding a box on the day", () => {
  it("finds a box by its name or by what is in it, and says where it is going", () => {
    const ceremony = blocks.find((block) => block.label === "Ceremony")!;
    const where = `${ceremony.location}, by ${formatClock(ceremony.startMin)}`;
    expect(findBoxes(doc, "rings")).toEqual([
      { key: "box-rings", box: "The rings and the paperwork", item: null, where },
      { key: expect.stringContaining("box-rings:"), box: "The rings and the paperwork", item: "The rings", where },
    ]);
    expect(findBoxes(doc, "")).toEqual([]);
  });

  it("finds nothing in Boxes when the Boxes tool is hidden", () => {
    expect(findBoxes(migrate({ ...raw, tools: withTool(raw, "boxes", false) }), "rings")).toEqual([]);
  });
});

describe("the walking order, on the day", () => {
  const raw = () => JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));

  it("is the processional in order, under the ceremony's block, with names and music", () => {
    const walk = walkingOrder(doc)!;
    expect(walk.blockId).toBe("blk-ceremony");
    expect(walk.groups[0]).toMatchObject({ cue: "In place before the music starts", song: null });
    expect(walk.groups[1]!.song).toBe("Air on the G String — J. S. Bach");
    expect(walk.groups[1]!.names.length).toBeGreaterThan(0);
  });

  it("is nothing while Ceremony is hidden", () => {
    const r = raw();
    expect(walkingOrder(migrate({ ...r, tools: withTool(r, "ceremony", false) }))).toBeNull();
  });

  it("is nothing with no processional", () => {
    const r = raw();
    expect(walkingOrder(migrate({ ...r, ceremony: { ...r.ceremony, processional: [] } }))).toBeNull();
  });
});
