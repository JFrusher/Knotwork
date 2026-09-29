import { describe, expect, it } from "vitest";
import { defaultCard, defaultSheet, defaultTemplate } from "../core/template/defaults";
import { load, type Persisted } from "./persist";

const design = () => ({
  card: defaultCard(),
  sheet: defaultSheet(),
  template: defaultTemplate(["First Name", "Last Name"]),
});

const good = (over: Partial<Persisted> = {}): Persisted => ({
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

  it("accepts a well-formed save", () => {
    const result = load(good());
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.data.rows).toHaveLength(1);
    expect(result.status === "ok" && result.data.savedAt).toBe("2026-08-17T13:42:00.000Z");
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
    expect(result.status === "ok" && Object.keys(result.data).sort()).toEqual(Object.keys(good()).sort());
  });

  it("gives rows positional ids when the save predates them", () => {
    // Overrides keyed by those same positional ids still land after an upgrade.
    const { rowIds: _rowIds, ...older } = good();
    const result = load(older);
    expect(result.status === "ok" && result.data.rowIds).toEqual(["r0"]);
  });

  it("upgrades a v1 save, which had no timestamp", () => {
    const { savedAt: _savedAt, ...v1 } = good({ version: 1 });
    const result = load(v1);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.version).toBe(2);
    expect(result.data.savedAt).toBeNull();
    expect(result.data.rows).toHaveLength(1);
  });
});
