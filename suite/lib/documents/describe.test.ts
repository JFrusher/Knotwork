// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeChanges, fieldChanges, partName } from "./describe";

describe("parts in words", () => {
  it("names a record by what it is called, and a slice by what it holds", () => {
    expect(partName("guests/g1", { firstName: "Ada", lastName: "Byron" })).toBe("Ada Byron (a guest)");
    expect(partName("seating/tables/t1", { label: "Table 3" })).toBe("Table 3 (a table)");
    expect(partName("timeline/blocks/b1", { label: "Speeches" })).toBe("Speeches (a block of the day)");
    expect(partName("guests/g1", undefined)).toBe("A guest");
    expect(partName("stationery", {})).toBe("The card design");
  });

  it("shows where two versions of one guest differ, field by field", () => {
    expect(
      fieldChanges(
        { firstName: "Ada", rsvpStatus: "confirmed", dietaryRaw: "Vegan", tags: [] },
        { firstName: "Ada", rsvpStatus: "declined", dietaryRaw: "", tags: ["uni"] },
      ),
    ).toEqual([
      { field: "Reply", mine: "confirmed", theirs: "declined" },
      { field: "Food", mine: "Vegan", theirs: "—" },
      { field: "Tags", mine: "0 items", theirs: "1 item" },
    ]);
  });

  it("says a removed part was removed", () => {
    expect(fieldChanges({ label: "Table 3" }, undefined)).toEqual([{ field: "The whole of it", mine: "changed", theirs: "Removed" }]);
  });
});

describe("what changed between two versions", () => {
  const before = {
    event: { coupleNames: "Alex & Sam" },
    guests: { g1: { id: "g1", firstName: "Ada" }, g2: { id: "g2", firstName: "Alan" } },
    timeline: { lanes: ["Main"], blocks: [{ id: "b1", label: "A" }, { id: "b2", label: "B" }] },
  };

  it("counts guests added, taken off and changed, and names what else changed", () => {
    const after = {
      event: { coupleNames: "Alex & Sam", date: "2028-06-01" },
      guests: { g1: { id: "g1", firstName: "Ada", rsvpStatus: "confirmed" }, g3: { id: "g3", firstName: "Grace" }, g4: { id: "g4", firstName: "Edsger" } },
      timeline: before.timeline,
    };
    expect(describeChanges(before, after)).toEqual([
      "Guests: 2 added, 1 taken off, 1 changed",
      "The wedding’s names, date and venue: changed",
    ]);
  });

  it("says when the day was only put in a new order", () => {
    const after = { ...before, timeline: { lanes: ["Main"], blocks: [before.timeline.blocks[1], before.timeline.blocks[0]] } };
    expect(describeChanges(before, after)).toEqual(["The day’s blocks put in a new order"]);
  });

  it("says nothing of a version that changed nothing", () => {
    expect(describeChanges(before, before)).toEqual([]);
  });
});
