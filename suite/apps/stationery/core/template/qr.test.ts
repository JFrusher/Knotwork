import { describe, expect, it } from "vitest";
import type { CardSpec, QrElement, ResolvedIcon } from "../types";
import { noFit, resolveCard } from "./bindings";
import { QUIET_MODULES, qrPath } from "./qr";

const card: CardSpec = { widthMm: 90, heightMm: 50, fold: "none", foldPositionMm: 0, invertBackPanel: false, bleedMm: 0 };
const qr = (over: Partial<QrElement> = {}): QrElement => ({
  kind: "qr",
  id: "q",
  x: 60,
  y: 10,
  w: 25,
  h: 25,
  z: 0,
  data: "{{Guest Link}}",
  colorHex: "#000000",
  ...over,
});
const resolve = (el: QrElement, row: Record<string, string>) =>
  resolveCard({ elements: [el], backgroundHex: null }, row, card, { fitText: noFit, iconPath: () => null });

describe("a QR code", () => {
  it("is a square of modules with its quiet zone, as one path", () => {
    const { pathD, view } = qrPath("https://example.org/seat/abc#k=xyz");
    expect(view.w).toBe(view.h);
    expect(view.x).toBe(-QUIET_MODULES);
    // Version 3 at level M: 29 modules.
    expect(view.w - QUIET_MODULES * 2).toBe(29);
    // The top-left finder pattern starts with a seven-module run.
    expect(pathD.startsWith("M0 0h7v1h-7z")).toBe(true);
  });

  it("takes any text, accents and all", () => {
    expect(() => qrPath("Zoë & Søren — 结婚")).not.toThrow();
    expect(qrPath("Zoë")).not.toEqual(qrPath("Zoe"));
  });

  it("resolves to a filled shape from its row", () => {
    const { scene, warnings } = resolve(qr(), { "Guest Link": "https://example.org/seat/abc" });
    expect(warnings).toEqual([]);
    expect(scene.elements[0]).toMatchObject({ kind: "icon", x: 60, y: 10, w: 25, h: 25 });
    expect((scene.elements[0] as ResolvedIcon).pathD).toBeTruthy();
  });

  it("says how to get a guest link rather than printing an empty code", () => {
    const { scene, warnings } = resolve(qr(), { "Guest Link": "" });
    expect(scene.elements).toEqual([]);
    expect(warnings).toContainEqual(expect.objectContaining({ kind: "empty-text", detail: expect.stringMatching(/Publish one from the Data menu/) }));
  });
});
