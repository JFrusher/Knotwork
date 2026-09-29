import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => undefined,
  del: async () => undefined,
}));

const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { emptyTrousseau, migrate } = await import("@jfrusher/trousseau");
const { currentDoc, useStore } = await import("./store");

function open(event: Record<string, unknown>) {
  const doc = emptyTrousseau();
  const raw = { ...doc, event: { ...doc.event, ...event } };
  useTrousseauStore.setState({
    status: "ready",
    error: null,
    raw: raw as unknown as Record<string, unknown>,
    doc: migrate(raw),
    past: [],
    future: [],
  });
}

beforeEach(() => {
  useStore.setState({ selectedId: null, preview: null, notice: null });
});

/**
 * A date moved in the Data panel while Timeline is open must outlive Timeline's
 * next edit.
 *
 * Timeline used to copy the wedding's date and names into its own day when it
 * mounted, and mirror them back into `event` on every write — so the next edit
 * to anything on the day put the old date back. It keeps no copy now, and
 * this is the case that proves it.
 */
test("a date set in the Data panel survives the next Timeline edit", () => {
  open({ date: "2028-06-01", coupleNames: "Alex & Sam" });

  // The Data panel, over the top of it.
  const shared = useTrousseauStore.getState();
  shared.setSlice("event", { ...shared.doc.event, date: "2029-01-01" });
  expect(currentDoc().day.date).toBe("2029-01-01");

  // An unrelated Timeline edit.
  useStore.getState().setDay({ venueName: "The Old Granary" });

  expect(useTrousseauStore.getState().doc.event.date).toBe("2029-01-01");
});

/**
 * One editor per fact. The names, the venue and the date are the Data panel's;
 * the curfew and the clocks are Timeline's. Timeline's echo of the first three
 * is never written back, whatever it holds — and its own two always are.
 */
test("Timeline writes its curfew into the wedding, and never the names, venue or date", () => {
  open({ date: "2029-01-01", coupleNames: "Robin & Kit", venueName: "The Barn" });

  // An echo that disagrees, however it came to — and a curfew edit, which is Timeline's own.
  useStore.getState().setDay({ date: "2000-01-01", coupleNames: "Old Names", venueName: "Elsewhere", curfewMin: 1380 });

  const event = useTrousseauStore.getState().doc.event;
  expect(event).toMatchObject({ date: "2029-01-01", coupleNames: "Robin & Kit", venueName: "The Barn" });
  expect(event.curfewMin).toBe(1380);
});

test("every edit republishes the resolved day, for Delegation and the Binder to read", () => {
  open({ date: "2028-06-01" });
  useStore.getState().addBlock("Main day", { label: "Ceremony", anchorMin: 810, durationMin: 45 });
  const day = useTrousseauStore.getState().doc.day;
  expect(day?.blocks.map((block) => [block.label, block.startMin])).toEqual([["Ceremony", 810]]);
});
