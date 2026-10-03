import { describe, expect, it } from "vitest";
import {
  SLICE_NAMES,
  KNOTWORK_KIND,
  KNOTWORK_VERSION,
  emptyKnotwork,
  migrate,
  knotworkSchema,
} from "./envelope.js";

describe("emptyKnotwork", () => {
  it("is a valid document", () => {
    expect(knotworkSchema.safeParse(emptyKnotwork()).success).toBe(true);
  });

  it("has no day until one is published", () => {
    expect(emptyKnotwork().day).toBeNull();
  });

  it("returns a fresh object each call, so callers cannot share state", () => {
    const a = emptyKnotwork();
    a.event.coupleNames = "A & B";
    expect(emptyKnotwork().event.coupleNames).toBe("");
  });
});

describe("SLICE_NAMES", () => {
  it("lists exactly the thirteen publishable slices", () => {
    expect([...SLICE_NAMES]).toEqual([
      "event",
      "guests",
      "seating",
      "day",
      "crew",
      "stationery",
      "shots",
      "timeline",
      "tools",
      "cast",
      "ceremony",
      "boxes",
      "bar",
    ]);
  });

  it("does not include sources, which is not publishable", () => {
    expect(SLICE_NAMES).not.toContain("sources");
  });
});

describe("migrate", () => {
  it("accepts an empty object as a new, empty wedding", () => {
    const doc = migrate({});
    expect(doc.kind).toBe(KNOTWORK_KIND);
    expect(doc.version).toBe(KNOTWORK_VERSION);
  });

  it("accepts a document from the future rather than refusing it", () => {
    expect(() => migrate({ kind: KNOTWORK_KIND, version: 99 })).not.toThrow();
  });

  it("throws on something that is not a Knotwork document at all", () => {
    expect(() => migrate({ kind: "cadence.day", version: 1 })).toThrow();
  });

  it("throws on a slice of the wrong type rather than discarding it", () => {
    expect(() => migrate({ guests: "everyone" })).toThrow();
  });
});

describe("documents saved before the rename", () => {
  it("still read, and read as Knotwork", () => {
    expect(migrate({ kind: "trousseau", version: 1 }).kind).toBe(KNOTWORK_KIND);
  });

  it("are not confused with anything else", () => {
    expect(() => migrate({ kind: "cadence.day" })).toThrow();
  });
});
