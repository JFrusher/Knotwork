// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { contacts, dayClock, findGuests, nowAndNext, runningOrder } from "./binder";

const doc = migrate(JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8")));
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
