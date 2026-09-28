import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => undefined,
  del: async () => undefined,
}));

const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { readDoc } = await import("./sliceBridge");
const { emptyTrousseau } = await import("@jfrusher/trousseau");

/**
 * Guests arriving from the shared wedding must be displayable in Seating.
 *
 * Tableaux renders and sorts by `fullName`, and derives it inside its own
 * addGuest/updateGuest. Nothing derived it for guests that came from anywhere
 * else — the suite's CSV import, a restored backup, the example wedding — so
 * the panel counted a hundred guests and showed a hundred blank rows, and
 * nobody could be seated at all.
 */

function withGuests(guests: Record<string, unknown>) {
  const doc = { ...emptyTrousseau(), guests };
  useTrousseauStore.setState({
    status: "ready",
    error: null,
    raw: doc as unknown as Record<string, unknown>,
    doc: doc as never,
    past: [],
    future: [],
  });
}

beforeEach(() => {
  useTrousseauStore.setState({ generation: 0 });
});

test("a guest with only first and last names still has a name to show", () => {
  withGuests({ g1: { id: "g1", firstName: "Alexander", lastName: "Okonkwo" } });

  const guest = readDoc().guests["g1"] as { fullName?: string };
  expect(guest.fullName).toBe("Alexander Okonkwo");
});

test("a first name on its own is enough", () => {
  withGuests({ g1: { id: "g1", firstName: "Priya", lastName: "" } });

  const guest = readDoc().guests["g1"] as { fullName?: string };
  expect(guest.fullName).toBe("Priya");
});

test("a fullName the guest already carries is left exactly as it is", () => {
  // Tableaux allows a name that is not simply first + last — a title, a
  // couple sharing a card. Deriving over the top would quietly rewrite it.
  withGuests({
    g1: { id: "g1", firstName: "Eleanor", lastName: "Abernathy", fullName: "Dr Eleanor Abernathy" },
  });

  const guest = readDoc().guests["g1"] as { fullName?: string };
  expect(guest.fullName).toBe("Dr Eleanor Abernathy");
});

test("a guest with no name at all is still listed rather than dropped", () => {
  withGuests({ g1: { id: "g1" } });

  const guest = readDoc().guests["g1"] as { fullName?: string };
  expect(guest.fullName).toBe("New guest");
});

test("every other field on the guest survives untouched", () => {
  withGuests({
    g1: { id: "g1", firstName: "Tobias", lastName: "Wright", dietary: "Vegetarian", tags: ["usher"] },
  });

  expect(readDoc().guests["g1"]).toMatchObject({
    id: "g1",
    dietary: "Vegetarian",
    tags: ["usher"],
  });
});

/**
 * What the Data panel writes while Seating is open must outlive Seating's next
 * autosave.
 *
 * Seating copies the guests, the room and the wedding's names into its own
 * store when it mounts, and writes that copy back after every edit. The Data
 * panel sits over it in a dialog and writes the shared wedding directly, so
 * Seating's copy never saw the import: the next table rename put the old guest
 * list and the old names back, with "3 new" still on screen.
 */
test("a guest import and a rename made in the Data panel survive Seating's next save", async () => {
  const { useStore } = await import("./useStore.js");
  const { saveNow } = await import("../hooks/useAutoSave.js");
  const { HOLDS } = await import("@/lib/store/toolGeneration");

  withGuests({ g1: { id: "g1", firstName: "Ada", lastName: "Test" } });
  useTrousseauStore.getState().setSlice("event", { ...emptyTrousseau().event, coupleNames: "Old Names" });

  // Seating opens: the gate declares what it holds, the tool takes its copy.
  useTrousseauStore.getState().hold("tableaux", HOLDS.tableaux);
  useStore.getState().hydrate(readDoc());

  // The Data panel, over the top of it.
  const shared = useTrousseauStore.getState();
  shared.setSlice("guests", {
    ...shared.raw["guests"] as Record<string, unknown>,
    g2: { id: "g2", firstName: "Bea", lastName: "Test" },
    g3: { id: "g3", firstName: "Cy", lastName: "Test" },
  });
  const named = useTrousseauStore.getState();
  named.setSlice("event", { ...named.doc.event, coupleNames: "New Names" });

  // Back in Seating, one ordinary edit and its autosave.
  useStore.getState().addTable({ type: "round", x: 100, y: 100 });
  saveNow({ manual: false });

  const after = useTrousseauStore.getState().doc;
  expect(Object.keys(after.guests).sort()).toEqual(["g1", "g2", "g3"]);
  expect(after.event.coupleNames).toBe("New Names");

  useTrousseauStore.getState().release("tableaux");
});
