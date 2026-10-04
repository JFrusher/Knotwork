import { describe, expect, it } from "vitest";
import { defaultCard, defaultSheet, defaultTemplate } from "../core/template/defaults";
import { load } from "./persist";
import { FIRST_PIECE } from "./suite";

const design = () => ({
  card: defaultCard(),
  sheet: defaultSheet(),
  template: defaultTemplate(["First Name", "Last Name"]),
});

/** A save from before pieces: one flat design. Every one of these must still open. */
const good = (over: Record<string, unknown> = {}) => ({
  version: 2,
  savedAt: "2026-08-17T13:42:00.000Z",
  ...design(),
  headers: ["First Name", "Last Name"],
  rows: [{ "First Name": "Charis", "Last Name": "Smith" }],
  rowIds: ["r0"],
  merged: {},
  csvIssues: [],
  fileName: "guests.csv",
  uploadedIcons: {},
  assetNames: {},
  snapEnabled: true,
  sheetCollapsed: false,
  ...over,
});

describe("load", () => {
  it("reports nothing saved", () => {
    expect(load(null)).toEqual({ status: "empty" });
    expect(load(undefined)).toEqual({ status: "empty" });
    // An envelope something else wrote, before any design.
    expect(load({})).toEqual({ status: "empty" });
  });

  it("opens a single-design save as the one piece it always was", () => {
    const result = load(good());
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.version).toBe(3);
    expect(result.data.savedAt).toBe("2026-08-17T13:42:00.000Z");
    expect(result.data.pieces).toHaveLength(1);
    expect(result.data.pieces[0]).toMatchObject({ ...FIRST_PIECE, fileName: "guests.csv" });
    expect(result.data.pieces[0]!.rows).toHaveLength(1);
    expect(result.problem).toBeNull();
  });

  it("discards a save from another version rather than half-applying it", () => {
    const result = load(good({ version: 99 }));
    expect(result.status).toBe("discarded");
    expect(result.status === "discarded" && result.reason).toMatch(/different version/);
  });

  it("discards a save missing its design", () => {
    const { card: _card, ...rest } = good();
    expect(load(rest)).toMatchObject({ status: "discarded" });
  });

  it("discards a template with no element list", () => {
    const broken = { ...good(), template: { backgroundHex: null } };
    expect(load(broken)).toMatchObject({ status: "discarded" });
  });

  it("discards a design whose numbers are not numbers", () => {
    // Hand-edited or half-migrated storage. Left unchecked these reach the
    // layout maths and silently produce zero sheets.
    const stringy = load({ ...good(), card: { ...good().card, widthMm: "85" } });
    expect(stringy).toMatchObject({ status: "discarded" });
    expect(stringy.status === "discarded" && stringy.reason).toMatch(/widthMm/);

    expect(
      load({ ...good(), sheet: { ...good().sheet, gapXMm: null } }),
    ).toMatchObject({ status: "discarded" });
  });

  it("discards NaN and Infinity, and the null JSON makes of them", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(load({ ...good(), card: { ...good().card, bleedMm: value } })).toMatchObject({ status: "discarded" });
    }
  });

  it("discards a save whose guest list is not a list", () => {
    expect(load({ ...good(), rows: "nope" })).toMatchObject({
      status: "discarded",
    });
  });

  it("discards a bare array or primitive", () => {
    expect(load([])).toMatchObject({ status: "discarded" });
    expect(load(42)).toMatchObject({ status: "discarded" });
  });

  it("reads a design saved when the undo history travelled with it, and leaves the history behind", () => {
    const result = load({ ...good(), past: [design()], future: [] });
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && Object.keys(result.data)).not.toContain("past");
    expect(result.status === "ok" && Object.keys(result.data.pieces[0]!)).not.toContain("past");
  });

  it("gives rows positional ids when the save predates them", () => {
    // Overrides keyed by those same positional ids still land after an upgrade.
    const { rowIds: _rowIds, ...older } = good();
    const result = load(older);
    expect(result.status === "ok" && result.data.pieces[0]!.rowIds).toEqual(["r0"]);
  });

  it("upgrades a v1 save, which had no timestamp", () => {
    const { savedAt: _savedAt, ...v1 } = good({ version: 1 });
    const result = load(v1);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.version).toBe(3);
    expect(result.data.savedAt).toBeNull();
    expect(result.data.pieces[0]!.rows).toHaveLength(1);
  });
});

describe("load, with pieces", () => {
  const piece = (id: string, name: string, over: Record<string, unknown> = {}) => {
    const { version: _v, savedAt: _s, uploadedIcons: _u, assetNames: _a, snapEnabled: _n, sheetCollapsed: _c, ...own } = good();
    return { id, name, ...own, ...over };
  };
  const suite = (pieces: unknown[]) => ({
    version: 3,
    savedAt: null,
    pieces,
    uploadedIcons: { "user:leaf": "M0 0" },
    assetNames: { "user:x": "Monogram.png" },
    snapEnabled: false,
    sheetCollapsed: true,
  });

  it("reads every piece in order, with what they share", () => {
    const result = load(suite([piece("a", "Place cards"), piece("b", "Table numbers")]));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.pieces.map((p) => p.name)).toEqual(["Place cards", "Table numbers"]);
    expect(result.data.assetNames).toEqual({ "user:x": "Monogram.png" });
    expect(result.data.uploadedIcons).toEqual({ "user:leaf": "M0 0" });
    expect(result.data.snapEnabled).toBe(false);
    expect(result.data.sheetCollapsed).toBe(true);
  });

  it("leaves out a piece it cannot read, keeps the rest, and names the one it lost", () => {
    const broken = piece("b", "Table numbers", { card: { ...good().card, widthMm: "100" } });
    const result = load(suite([piece("a", "Place cards"), broken]));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.pieces.map((p) => p.id)).toEqual(["a"]);
    expect(result.problem).toMatch(/widthMm.*"Table numbers" was left out/);
  });

  it("leaves out a second piece under an id already read", () => {
    const result = load(suite([piece("a", "Place cards"), piece("a", "Escort cards")]));
    expect(result.status === "ok" && result.data.pieces.map((p) => p.name)).toEqual(["Place cards"]);
    expect(result.status === "ok" && result.problem).toMatch(/Escort cards/);
  });

  it("discards a suite with no readable piece", () => {
    expect(load(suite([]))).toMatchObject({ status: "discarded" });
    expect(load(suite([piece("", "Nameless")]))).toMatchObject({ status: "discarded" });
    expect(load({ ...suite([]), pieces: "nope" })).toMatchObject({ status: "discarded" });
  });
});
