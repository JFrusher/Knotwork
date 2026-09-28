// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useTrousseauStore } from "./useTrousseauStore";
import { HOLDS, mayWrite, noteRead } from "./toolGeneration";
import { readDoc, writeDoc } from "@/apps/tableaux/store/sliceBridge";

/**
 * The bug this exists to stop:
 *
 *   Restore a wedding from a file while a tool is open. The tool is still
 *   holding the previous one, and its autosave writes that back — so ninety-
 *   seven guests become the four that were there before, under a message
 *   saying the restore worked.
 */

const guestsIn = () =>
  Object.keys(
    (useTrousseauStore.getState().raw as { guests?: Record<string, unknown> }).guests ?? {},
  ).length;

beforeEach(() => {
  useTrousseauStore.getState().replaceDocument({});
});

describe("a tool holding a replaced wedding", () => {
  it("may write what it read", () => {
    noteRead("a-tool");
    expect(mayWrite("a-tool")).toBe(true);
  });

  it("may not write once the document has been swapped underneath it", () => {
    noteRead("a-tool");
    useTrousseauStore.getState().replaceDocument({ guests: { g1: { id: "g1" } } });
    expect(mayWrite("a-tool")).toBe(false);
  });

  it("may write again once it has re-read", () => {
    noteRead("a-tool");
    useTrousseauStore.getState().replaceDocument({ guests: { g1: { id: "g1" } } });
    noteRead("a-tool");
    expect(mayWrite("a-tool")).toBe(true);
  });

  it("does not hold back a tool that has never read", () => {
    // A fresh mount whose own read is moments away. Refusing here would throw
    // away real edits to protect against nothing.
    expect(mayWrite("never-read")).toBe(true);
  });

  it("does not put the old guest list back over a restored one", () => {
    // The whole thing, through a real seam.
    const before = readDoc();
    expect(guestsIn()).toBe(0);

    useTrousseauStore.getState().replaceDocument({
      guests: Object.fromEntries(
        Array.from({ length: 97 }, (_, i) => [`g${i}`, { id: `g${i}`, firstName: "Guest" }]),
      ),
    });
    expect(guestsIn()).toBe(97);

    // The stale instance autosaving on its way out.
    writeDoc(before);

    expect(guestsIn()).toBe(97);
  });
});

/**
 * The same bug, arriving by a slice rather than a whole document:
 *
 *   Open Seating, then import three guests from the Data panel. The panel says
 *   "3 new" and the header says 103 — and the next table rename in Seating
 *   writes its own copy of the 100 back over them.
 */
describe("a tool holding a slice somebody else writes", () => {
  beforeEach(() => {
    useTrousseauStore.getState().release("tableaux");
  });

  it("is sent back to re-read when anyone else writes a slice it holds", () => {
    useTrousseauStore.getState().hold("tableaux", HOLDS.tableaux);
    noteRead("tableaux");
    useTrousseauStore.getState().setSlice("guests", { g1: { id: "g1" } });
    expect(mayWrite("tableaux")).toBe(false);
  });

  it("is not sent back by its own write", () => {
    useTrousseauStore.getState().hold("tableaux", HOLDS.tableaux);
    noteRead("tableaux");
    useTrousseauStore.getState().setSlice("guests", { g1: { id: "g1" } }, { by: "tableaux" });
    expect(mayWrite("tableaux")).toBe(true);
  });

  it("is not sent back by a write to a slice it does not hold", () => {
    useTrousseauStore.getState().hold("tableaux", HOLDS.tableaux);
    noteRead("tableaux");
    useTrousseauStore.getState().setSlice("shots", { sections: [] });
    expect(mayWrite("tableaux")).toBe(true);
  });

  it("stops holding anything once it has closed", () => {
    // Seating visited earlier and since left must not remount whatever tool
    // is on screen now every time the Data panel touches the guest list.
    useTrousseauStore.getState().hold("tableaux", HOLDS.tableaux);
    useTrousseauStore.getState().release("tableaux");
    const before = useTrousseauStore.getState().generation;
    useTrousseauStore.getState().setSlice("guests", { g1: { id: "g1" } });
    expect(useTrousseauStore.getState().generation).toBe(before);
  });
});
