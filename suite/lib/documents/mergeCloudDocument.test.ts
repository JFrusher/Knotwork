import { expect, test } from "vitest";
import { SLICE_NAMES } from "@jfrusher/trousseau";
import { fingerprint } from "./fingerprint";
import { fingerprintParts, mergeCloudDocument } from "./mergeCloudDocument";

/** Every slice a stand-in value, so each is one whole part. */
function doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  for (const slice of SLICE_NAMES) base[slice] = { owner: "base" };
  return { ...base, ...overrides };
}

/** A day published from the merged timeline — marked, so a test can tell it was. */
const publish = (raw: Record<string, unknown>) => ({ publishedFrom: raw["timeline"] });
const merge = (local: Record<string, unknown>, server: Record<string, unknown>, agreed: Record<string, string>) =>
  mergeCloudDocument(local, server, agreed, publish);

test("a slice changed only on the server is taken", () => {
  const base = doc();
  const server = doc({ stationery: { owner: "server" } });

  const result = merge(base, server, fingerprintParts(base));

  expect(result.raw.stationery).toEqual({ owner: "server" });
  expect(result.conflicts).toEqual([]);
  expect(result.agreed.stationery).toBe(fingerprint({ owner: "server" }));
});

test("a slice changed only locally is kept, not overwritten", () => {
  const base = doc();
  const local = doc({ shots: { owner: "local" } });

  const result = merge(local, base, fingerprintParts(base));

  expect(result.raw.shots).toEqual({ owner: "local" });
  expect(result.conflicts).toEqual([]);
});

test("a slice changed on both sides is a conflict, and neither value is applied", () => {
  const base = doc();
  const agreed = fingerprintParts(base);
  const local = doc({ stationery: { owner: "local" } });
  const server = doc({ stationery: { owner: "server" } });

  const result = merge(local, server, agreed);

  expect(result.conflicts).toEqual([
    { key: "stationery", slice: "stationery", mine: { owner: "local" }, theirs: { owner: "server" } },
  ]);
  expect(result.raw.stationery).toEqual({ owner: "local" });
  expect(result.agreed.stationery).toBe(agreed.stationery);
  expect(result.adopted).toBe(false);
});

test("a document unchanged on both sides is left alone, agreed, and not adopted", () => {
  const base = doc();
  const result = merge(base, base, fingerprintParts(base));

  expect(result.conflicts).toEqual([]);
  expect(result.raw).toEqual(base);
  expect(result.agreed.event).toBe(fingerprint(base.event));
  expect(result.adopted).toBe(false);
});

test("the baseline covers every part, and never the published day", () => {
  const agreed = fingerprintParts(doc());
  expect(Object.keys(agreed)).not.toContain("day");
  expect(Object.keys(agreed)).toContain("event");
});

test("a top-level key only the server has survives the merge", () => {
  // A slice belonging to a tool a newer build of the suite added. Dropping it
  // here would push it away.
  const base = doc();
  const server = doc({ favours: { owner: "a newer build" } });

  const result = merge(base, server, fingerprintParts(base));

  expect(result.raw.favours).toEqual({ owner: "a newer build" });
  expect(result.adopted).toBe(true);
});

// Record by record ------------------------------------------------------------

const guest = (id: string, rsvpStatus: string) => ({ id, firstName: id, rsvpStatus });

test("two people changing two different guests both keep their change", () => {
  const base = doc({ guests: { ada: guest("ada", "pending"), alan: guest("alan", "pending") } });
  const local = doc({ guests: { ada: guest("ada", "confirmed"), alan: guest("alan", "pending") } });
  const server = doc({ guests: { ada: guest("ada", "pending"), alan: guest("alan", "declined") } });

  const result = merge(local, server, fingerprintParts(base));

  expect(result.conflicts).toEqual([]);
  expect(result.raw.guests).toEqual({ ada: guest("ada", "confirmed"), alan: guest("alan", "declined") });
  expect(result.adopted).toBe(true);
});

test("two people changing the same guest differently is a conflict about that guest alone", () => {
  const base = doc({ guests: { ada: guest("ada", "pending"), alan: guest("alan", "pending") } });
  const local = doc({ guests: { ada: guest("ada", "confirmed"), alan: guest("alan", "pending") } });
  const server = doc({ guests: { ada: guest("ada", "declined"), alan: guest("alan", "confirmed") } });

  const result = merge(local, server, fingerprintParts(base));

  expect(result.conflicts.map((conflict) => conflict.key)).toEqual(["guests/ada"]);
  expect(result.raw.guests).toEqual({ ada: guest("ada", "confirmed"), alan: guest("alan", "confirmed") });
});

test("a guest added on each side are both kept", () => {
  const base = doc({ guests: { ada: guest("ada", "pending") } });
  const local = doc({ guests: { ada: guest("ada", "pending"), alan: guest("alan", "pending") } });
  const server = doc({ guests: { ada: guest("ada", "pending"), grace: guest("grace", "pending") } });

  const result = merge(local, server, fingerprintParts(base));

  expect(result.conflicts).toEqual([]);
  // Each goes in after the guest it followed on its own side, as blocks do.
  expect(Object.keys(result.raw.guests as object)).toEqual(["ada", "grace", "alan"]);
});

test("a guest removed on one side is removed; removed on one and changed on the other is asked", () => {
  const base = doc({ guests: { ada: guest("ada", "pending"), alan: guest("alan", "pending") } });
  const server = doc({ guests: { alan: guest("alan", "pending") } });

  expect(merge(base, server, fingerprintParts(base)).raw.guests).toEqual({ alan: guest("alan", "pending") });

  const local = doc({ guests: { ada: guest("ada", "confirmed"), alan: guest("alan", "pending") } });
  const result = merge(local, server, fingerprintParts(base));
  expect(result.conflicts).toEqual([
    { key: "guests/ada", slice: "guests", mine: guest("ada", "confirmed"), theirs: undefined },
  ]);
});

const timeline = (blocks: Array<{ id: string; label: string }>) => ({ lanes: ["Main day"], blocks });

test("a block added on each side lands where it was added, and the day is published again", () => {
  const base = doc({ timeline: timeline([{ id: "a", label: "Ceremony" }, { id: "b", label: "Dinner" }]) });
  const local = doc({
    timeline: timeline([{ id: "a", label: "Ceremony" }, { id: "b", label: "Dinner" }, { id: "c", label: "Dancing" }]),
  });
  const server = doc({
    timeline: timeline([{ id: "a", label: "Ceremony" }, { id: "s", label: "Drinks" }, { id: "b", label: "Dinner" }]),
  });

  const result = merge(local, server, fingerprintParts(base));

  expect(result.conflicts).toEqual([]);
  const merged = result.raw.timeline as { blocks: Array<{ id: string }> };
  expect(merged.blocks.map((block) => block.id)).toEqual(["a", "s", "b", "c"]);
  // Neither side's own timeline, so neither side's published day will do.
  expect(result.raw.day).toEqual({ publishedFrom: result.raw.timeline });
});

test("a reorder made only on the server is taken, with the day that goes with it", () => {
  const base = doc({ timeline: timeline([{ id: "a", label: "A" }, { id: "b", label: "B" }]), day: { from: "base" } });
  const server = doc({ timeline: timeline([{ id: "b", label: "B" }, { id: "a", label: "A" }]), day: { from: "server" } });

  const result = merge(base, server, fingerprintParts(base));

  expect((result.raw.timeline as { blocks: Array<{ id: string }> }).blocks.map((block) => block.id)).toEqual(["b", "a"]);
  expect(result.raw.day).toEqual({ from: "server" });
  expect(result.adopted).toBe(true);
});

test("the day is this side's own when the timeline and the event are", () => {
  const base = doc({ timeline: timeline([{ id: "a", label: "A" }]), day: { from: "mine" } });
  const server = doc({ timeline: timeline([{ id: "a", label: "A" }]), day: { from: "theirs" }, stationery: { owner: "server" } });

  expect(merge(base, server, fingerprintParts(base)).raw.day).toEqual({ from: "mine" });
});

const box = (id: string, packed: boolean) => ({ id, number: 1, name: id, items: [{ id: `${id}-item`, label: "Shoes", quantity: 1, packed }] });

test("two people packing two different boxes both keep what they ticked", () => {
  const base = doc({ boxes: { boxes: [box("ready", false), box("overnight", false)] } });
  const local = doc({ boxes: { boxes: [box("ready", true), box("overnight", false)] } });
  const server = doc({ boxes: { boxes: [box("ready", false), box("overnight", true)] } });

  const result = merge(local, server, fingerprintParts(base));

  expect(result.conflicts).toEqual([]);
  expect(result.raw.boxes).toEqual({ boxes: [box("ready", true), box("overnight", true)] });
});
