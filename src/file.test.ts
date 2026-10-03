import { describe, expect, it } from "vitest";
import { emptyKnotwork } from "./envelope.js";
import { KNOTWORK_EXTENSION, parse, serialise, suggestedFilename } from "./file.js";

describe("serialise", () => {
  it("ends with a newline, so the file is well-formed on disk", () => {
    expect(serialise(emptyKnotwork()).endsWith("\n")).toBe(true);
  });

  it("is indented, so a diff of two weddings is readable", () => {
    expect(serialise(emptyKnotwork())).toContain('\n  "kind"');
  });
});

describe("parse", () => {
  it("round-trips a document", () => {
    const doc = emptyKnotwork();
    doc.event.coupleNames = "Charis & Jacob";
    expect(parse(serialise(doc)).event.coupleNames).toBe("Charis & Jacob");
  });

  it("keeps a slice it does not know about", () => {
    const text = JSON.stringify({ kind: "knotwork", version: 1, florals: { arch: "peonies" } });
    expect(parse(text)).toMatchObject({ florals: { arch: "peonies" } });
  });

  it("explains itself when handed something that is not JSON", () => {
    expect(() => parse("not json at all")).toThrow(/not valid JSON/);
  });

  it("explains itself when handed a Cadence day", () => {
    const day = JSON.stringify({ kind: "cadence.day", version: 1 });
    expect(() => parse(day)).toThrow(/not a Knotwork file/);
  });

  it("carries an unknown slice through serialise and back", () => {
    const doc = { ...emptyKnotwork(), florals: { arch: "peonies", budget: 1200 } };
    const back = parse(serialise(doc as Parameters<typeof serialise>[0]));
    expect(back).toMatchObject({ florals: { arch: "peonies", budget: 1200 } });
  });

  it("parses a document with no kind at all, since kind has a default", () => {
    expect(parse(JSON.stringify({ version: 1 })).kind).toBe("knotwork");
  });

  it("refuses a JSON array", () => {
    expect(() => parse("[]")).toThrow(/not a Knotwork file/);
  });

  it("refuses JSON null", () => {
    expect(() => parse("null")).toThrow(/not a Knotwork file/);
  });

  it("explains a malformed slice rather than dumping a validation error", () => {
    const bad = JSON.stringify({ kind: "knotwork", version: 1, guests: "oops" });
    expect(() => parse(bad)).toThrow(/could not be read/);
  });
});

describe("suggestedFilename", () => {
  it("uses the couple's names", () => {
    const doc = emptyKnotwork();
    doc.event.coupleNames = "Charis & Jacob";
    expect(suggestedFilename(doc)).toBe(`charis-and-jacob${KNOTWORK_EXTENSION}`);
  });

  it("falls back when there are no names yet", () => {
    expect(suggestedFilename(emptyKnotwork())).toBe(`wedding${KNOTWORK_EXTENSION}`);
  });
});

describe("a file exported before the rename", () => {
  it("opens", () => {
    expect(parse(JSON.stringify({ kind: "trousseau", version: 1 })).kind).toBe("knotwork");
  });
});

describe("suggestedFilename on awkward names", () => {
  it("trims separators from both ends and keeps one between words", () => {
    expect(suggestedFilename({ ...emptyKnotwork(), event: { ...emptyKnotwork().event, coupleNames: "  --Ann & Bo!!  " } })).toBe(
      "ann-and-bo.knotwork.json",
    );
  });

  it("stays linear on a name that is mostly separators", () => {
    const coupleNames = `a${"-".repeat(100_000)}b`;
    const started = performance.now();
    expect(suggestedFilename({ ...emptyKnotwork(), event: { ...emptyKnotwork().event, coupleNames } })).toBe("a-b.knotwork.json");
    expect(performance.now() - started).toBeLessThan(100);
  });
});
