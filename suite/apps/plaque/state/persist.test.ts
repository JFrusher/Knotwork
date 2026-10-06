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
    expect(result.data.pieces[0]).toMatchObject(FIRST_PIECE);
    // The rows it printed are the room's to say now; none are kept.
    expect(Object.keys(result.data.pieces[0]!).sort()).toEqual(["booklet", "card", "id", "merged", "name", "printed", "sheet", "template"]);
    // Cards, as every piece saved before booklets was.
    expect(result.data.pieces[0]!.booklet).toBeNull();
    expect(result.problem).toBeNull();
  });

  it("keeps how a booklet is printed", () => {
    const opened = load(good());
    if (opened.status !== "ok") throw new Error("the fixture did not load");
    const booklet = { ...opened.data.pieces[0]!, booklet: { output: "shop", paper: "A4" } };
    const again = load({ ...opened.data, pieces: [booklet] });
    expect(again.status === "ok" && again.data.pieces[0]!.booklet).toEqual({ output: "shop", paper: "A4" });
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

  it("moves a guest's own change from the row they were on to the guest", () => {
    const tweak = { fontSizePt: 11 };
    const saved = good({ template: { ...design().template, overrides: { r0: { name: tweak } } } });
    const result = load(saved, (row) => (row["First Name"] === "Charis" ? "g7" : null));
    expect(result.status === "ok" && result.data.pieces[0]!.template.overrides).toEqual({ g7: { name: tweak } });
    expect(result.status === "ok" && result.problem).toBeNull();
  });

  it("finds the rows of a save from before rows had ids by their position", () => {
    const { rowIds: _rowIds, ...older } = good({ template: { ...design().template, overrides: { r0: { name: {} } } } });
    const result = load(older, () => "g7");
    expect(result.status === "ok" && Object.keys(result.data.pieces[0]!.template.overrides!)).toEqual(["g7"]);
  });

  it("says so when a guest's own change matches nobody on the list any more", () => {
    const saved = good({ template: { ...design().template, overrides: { r0: { name: { fontSizePt: 11 } } } } });
    const result = load(saved, () => null);
    expect(result.status === "ok" && result.data.pieces[0]!.template.overrides).toEqual({});
    expect(result.status === "ok" && result.problem).toMatch(/One guest's own change to "Place cards"/);
  });

  it("keeps two guests on one card, now by who they are", () => {
    const ada = { "First Name": "Ada" };
    const grace = { "First Name": "Grace" };
    const saved = good({
      rows: [{ "First Name": "Ada & Grace" }],
      rowIds: ["merged:x"],
      merged: { "merged:x": { indexes: [0, 1], ids: ["r0", "r1"], rows: [ada, grace] } },
      template: { ...design().template, overrides: { "merged:x": { name: { fontSizePt: 9 } } } },
    });
    const ids: Record<string, string> = { Ada: "g1", Grace: "g2" };
    const result = load(saved, (row) => ids[row["First Name"]!] ?? null);
    expect(result.status === "ok" && result.data.pieces[0]!.merged).toEqual({ "merged:x": ["g1", "g2"] });
    expect(result.status === "ok" && Object.keys(result.data.pieces[0]!.template.overrides!)).toEqual(["merged:x"]);
  });

  it("upgrades a v1 save, which had no timestamp", () => {
    const { savedAt: _savedAt, ...v1 } = good({ version: 1 });
    const result = load(v1);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.version).toBe(3);
    expect(result.data.savedAt).toBeNull();
    expect(result.data.pieces).toHaveLength(1);
  });
});

describe("load, with pieces", () => {
  const piece = (id: string, name: string, over: Record<string, unknown> = {}) => ({
    id,
    name,
    ...design(),
    merged: {},
    ...over,
  });
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

  it("reads who shares a card, and leaves out a piece whose combines are not guest lists", () => {
    const result = load(suite([piece("a", "Place cards", { merged: { "merged:x": ["g1", "g2"] } }), piece("b", "Menus", { merged: { m: { rows: [] } } })]));
    expect(result.status === "ok" && result.data.pieces.map((p) => p.merged)).toEqual([{ "merged:x": ["g1", "g2"] }]);
    expect(result.status === "ok" && result.problem).toMatch(/combined cards on "Menus"/);
  });

  it("reads what a piece was last printed as, and says so when it cannot", () => {
    const printed = { at: "2026-10-01T10:00:00Z", cards: { "row:g1": "abc:1" } };
    const ok = load(suite([piece("a", "Place cards", { printed })]));
    expect(ok.status === "ok" && ok.data.pieces[0]!.printed).toEqual(printed);

    const garbled = load(suite([piece("a", "Place cards", { printed: { at: 3 } })]));
    expect(garbled.status === "ok" && garbled.data.pieces[0]!.printed).toBeNull();
    expect(garbled.status === "ok" && garbled.problem).toMatch(/last printed as could not be read/);
  });

  it("discards a suite with no readable piece", () => {
    expect(load(suite([]))).toMatchObject({ status: "discarded" });
    expect(load(suite([piece("", "Nameless")]))).toMatchObject({ status: "discarded" });
    expect(load({ ...suite([]), pieces: "nope" })).toMatchObject({ status: "discarded" });
  });
});
