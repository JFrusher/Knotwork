// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assemble, partInfo, partsOf, withPart } from "./parts";

const example = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.trousseau.json"), "utf8"));

describe("a wedding in parts", () => {
  it("puts the example wedding back together exactly as it was", () => {
    expect(assemble(partsOf(example), example)).toEqual(example);
  });

  it("cuts guests, tables, blocks and jobs into one part each", () => {
    const keys = [...partsOf(example).keys()];
    const guests = Object.keys(example.guests).length;
    expect(keys.filter((key) => key.startsWith("guests/"))).toHaveLength(guests);
    expect(keys.filter((key) => key.startsWith("seating/tables/"))).toHaveLength(Object.keys(example.seating.tables).length);
    expect(keys.filter((key) => key.startsWith("timeline/blocks/"))).toHaveLength(example.timeline.blocks.length);
    expect(keys.filter((key) => key.startsWith("crew/jobs/"))).toHaveLength(example.crew.jobs.length);
    expect(keys).toContain("timeline/blocks#order");
    expect(keys).toContain("guests#order");
    // The published day is worked out again, never a part.
    expect(keys.some((key) => key.startsWith("day"))).toBe(false);
  });

  it("says what each part is", () => {
    expect(partInfo("guests/g1")).toEqual({ slice: "guests", record: { collection: "guests", id: "g1" }, order: false });
    expect(partInfo("seating/tables/t1")).toEqual({ slice: "seating", record: { collection: "tables", id: "t1" }, order: false });
    expect(partInfo("crew/jobs#order")).toEqual({ slice: "crew", record: null, order: true });
    expect(partInfo("seating")).toEqual({ slice: "seating", record: null, order: false });
    expect(partInfo("event")).toEqual({ slice: "event", record: null, order: false });
  });

  it("changes one part and leaves the rest", () => {
    const raw = { guests: { g1: { id: "g1", firstName: "Ada" }, g2: { id: "g2", firstName: "Alan" } }, timeline: { lanes: ["Main"], blocks: [{ id: "b1" }, { id: "b2" }] } };
    expect(withPart(raw, "guests/g2", undefined)).toEqual({ guests: { g1: { id: "g1", firstName: "Ada" } }, timeline: raw.timeline });
    // A block the order does not name yet goes at the end.
    expect(withPart(raw, "timeline/blocks/b3", { id: "b3" })).toMatchObject({ timeline: { blocks: [{ id: "b1" }, { id: "b2" }, { id: "b3" }] } });
  });

  it("invents nothing for a slice with no collection at all", () => {
    const raw = { seating: { room: { width: 20 } } };
    expect(assemble(partsOf(raw), raw)).toEqual(raw);
    expect(withPart(raw, "event", { date: "2028-06-01" }).seating).toEqual({ room: { width: 20 } });
  });

  it("keeps a collection whose records cannot be told apart whole, rather than losing any", () => {
    const raw = { timeline: { blocks: [{ id: "b1" }, { label: "no id" }] } };
    expect([...partsOf(raw).keys()]).toEqual(["timeline"]);
    expect(assemble(partsOf(raw), raw)).toEqual(raw);
  });
});
