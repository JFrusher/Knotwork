import { expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => undefined,
  del: async () => undefined,
}));

const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { HOLDS } = await import("@/lib/store/toolGeneration");
const { emptyTrousseau } = await import("@jfrusher/trousseau");
const { getDoc, useStore } = await import("./store");
const { persist, restore } = await import("./persist");

/**
 * A date moved in the Data panel while Timeline is open must outlive Timeline's
 * next save.
 *
 * Timeline copies the wedding's date and names into its own day when it mounts,
 * and mirrors them back into `event` on every write. The Data panel changes
 * `event` underneath it, so the next edit to anything on the day — a venue, a
 * block — put the old date back.
 */
test("a date set in the Data panel survives the next Timeline edit", () => {
  const doc = emptyTrousseau();
  const raw = { ...doc, event: { ...doc.event, date: "2028-06-01", coupleNames: "Alex & Sam" } };
  useTrousseauStore.setState({
    status: "ready",
    error: null,
    generation: 0,
    raw: raw as unknown as Record<string, unknown>,
    doc: raw,
    past: [],
    future: [],
  });

  // Timeline opens: the gate declares what it holds, the tool takes its copy.
  useTrousseauStore.getState().hold("cadence", HOLDS.cadence);
  useStore.getState().loadDoc(restore());

  // The Data panel, over the top of it.
  const shared = useTrousseauStore.getState();
  shared.setSlice("event", { ...shared.doc.event, date: "2029-01-01" });

  // An unrelated Timeline edit, handed to the autosave.
  useStore.getState().setDay({ venueName: "The Old Granary" });
  persist(getDoc(useStore.getState()));

  expect(useTrousseauStore.getState().doc.event.date).toBe("2029-01-01");

  useTrousseauStore.getState().release("cadence");
});

/**
 * One editor per fact. The names, the venue and the date are the Data panel's;
 * the curfew and the clocks are Timeline's. Timeline's copy of the first three
 * is never written back, whatever it holds — and its own two always are.
 */
test("Timeline writes its curfew into the wedding, and never the names, venue or date", () => {
  const doc = emptyTrousseau();
  const raw = {
    ...doc,
    event: { ...doc.event, date: "2029-01-01", coupleNames: "Robin & Kit", venueName: "The Barn" },
  };
  useTrousseauStore.setState({
    status: "ready",
    error: null,
    generation: 0,
    raw: raw as unknown as Record<string, unknown>,
    doc: raw,
    past: [],
    future: [],
  });
  useStore.getState().loadDoc(restore());

  // A copy that disagrees, however it came to — and a curfew edit, which is Timeline's own.
  useStore.getState().setDay({ date: "2000-01-01", coupleNames: "Old Names", venueName: "Elsewhere", curfewMin: 1380 });
  persist(getDoc(useStore.getState()));

  const event = useTrousseauStore.getState().doc.event;
  expect(event).toMatchObject({ date: "2029-01-01", coupleNames: "Robin & Kit", venueName: "The Barn" });
  expect(event.curfewMin).toBe(1380);
});
