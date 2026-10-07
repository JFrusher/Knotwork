import { beforeEach, expect, test, vi } from "vitest";
import { emptyKnotwork, migrate, parse, serialise } from "@jfrusher/knotwork";

const db = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => db.get(key),
  set: async (key: string, value: unknown) => void db.set(key, value),
  del: async (key: string) => void db.delete(key),
  keys: async () => [...db.keys()],
}));

const { STORAGE_KEY, flushPersist, useKnotworkStore } = await import(
  "@/lib/store/useKnotworkStore"
);
const { publishDay, readCrew, readGuests, readSeating, readTimeline, readShots, resolvedDay } = await import(
  "./slices"
);
const { useStore: useSeating } = await import("@/apps/tableaux/store/useStore");
const { DEFAULT_BLOCK_OUTPUTS } = await import("@/apps/timeline/core/model/defaults");
const { addJob, addPerson, seedTeamsFromTags, toggleAssignment } = await import(
  "@/lib/model/crewActions"
);
const { addSection, addShot, patchShot } = await import("@/lib/group-shots/actions");

/**
 * Step 4's requirement, as a test: a wedding built through the tools survives
 * an export and a restore with nothing lost — including keys this app has never
 * heard of.
 */

const store = () => useKnotworkStore.getState();

beforeEach(async () => {
  db.clear();
  const doc = emptyKnotwork();
  useKnotworkStore.setState({
    status: "idle",
    error: null,
    savedAt: null,
    raw: doc as unknown as Record<string, unknown>,
    doc,
  });
  await store().hydrate();
});

function buildAWedding(): void {
  store().setSlice("event", {
    date: "2026-09-12",
    coupleNames: "Charis & Jacob",
    venueName: "The barn",
    curfewMin: 23 * 60 + 30,
    utcOffsetMin: 60,
  });

  const guests = {
    g1: {
      id: "g1",
      firstName: "Eleanor",
      lastName: "Vane",
      email: "",
      rsvpStatus: "confirmed",
      dietary: "Gluten-Free",
      entree: "Chicken",
      notes: "",
      side: "bride",
      groupId: null,
      subgroupId: null,
      familyId: null,
      assignedTableId: null,
    },
  };
  store().setSlice("guests", guests);

  // Through Seating itself: its commands, written into the wedding.
  const added = useSeating.getState().addTable({ type: "round", x: 200, y: 200 });
  useSeating.getState().assignGuest("g1", added!.meta!["newTableId"] as string);

  const block = { anchorMin: null, gapMin: 0, bufferMin: 0, lane: "Couple", tags: [], location: "", notes: "" };
  const ceremony = "b-ceremony";
  const timeline = {
    ...readTimeline(store().doc),
    blocks: [
      { ...block, id: ceremony, label: "Ceremony", anchorMin: 13 * 60, durationMin: 45, tags: ["registrar"], outputs: [...DEFAULT_BLOCK_OUTPUTS] },
      { ...block, id: "b-drinks", label: "Drinks", durationMin: 90, gapMin: 15, outputs: [...DEFAULT_BLOCK_OUTPUTS] },
    ],
  };
  store().setSlices([
    ["timeline", timeline],
    ["day", publishDay(store().doc, timeline)],
  ]);

  let crew = seedTeamsFromTags(readCrew(store().doc), timeline);
  crew = addPerson(crew, "Marion", crew.teams[0]?.id ?? null);
  crew = addJob(crew, ceremony, "Hand over the rings");
  crew = toggleAssignment(crew, crew.jobs[0]!.id, crew.people[0]!.id);
  store().setSlice("crew", crew);

  let shots = addSection(readShots(store().doc), "Bride's family");
  const sectionId = shots.sections[0]!.id;
  shots = addShot(shots, sectionId);
  shots = patchShot(shots, shots.sections[0]!.shots[0]!.id, {
    label: "Bride with her mother",
    members: [{ kind: "guest", ref: "g1" }],
  });
  store().setSlice("shots", shots);
}

test("a floating block starts when the one before it ends, plus its gap", () => {
  buildAWedding();
  const placed = resolvedDay(store().doc);
  const [ceremony, drinks] = placed;

  expect(ceremony!.startMin).toBe(13 * 60);
  expect(ceremony!.endMin).toBe(13 * 60 + 45);
  expect(drinks!.startMin).toBe(13 * 60 + 60);
});

test("editing the timeline republishes the resolved day in the same change", () => {
  buildAWedding();
  const day = (store().raw as Record<string, unknown>)["day"] as Record<string, unknown>;

  expect(day["kind"]).toBe("cadence.day");
  const blocks = day["blocks"] as Array<Record<string, unknown>>;
  expect(blocks.map((b) => b["startMin"])).toEqual([13 * 60, 13 * 60 + 60]);
  // The published day carries the couple's own details, so a reader outside
  // this app knows whose wedding it is looking at.
  expect((day["day"] as Record<string, unknown>)["coupleNames"]).toBe("Charis & Jacob");
});

test("an exported backup restores byte for byte, unknown slices included", async () => {
  buildAWedding();

  // A slice belonging to a tool nobody has written yet.
  store().setSlice("photobooth" as never, { props: ["top hat"], hours: 3 });
  await flushPersist();

  const exported = serialise(migrate(store().raw));
  const restored = parse(exported);

  // Round-tripped through the contract's own reader and writer.
  expect(serialise(restored)).toBe(exported);

  store().replaceDocument(restored);
  await flushPersist();

  expect(readGuests(store().doc)["g1"]!.entree).toBe("Chicken");
  expect(Object.values(readSeating(store().doc).tables)[0]!.assignedGuestIds).toEqual(["g1"]);
  expect(readTimeline(store().doc).blocks.map((b) => b.label)).toEqual(["Ceremony", "Drinks"]);
  expect(readCrew(store().doc).jobs[0]!.label).toBe("Hand over the rings");
  expect(readShots(store().doc).sections[0]!.shots[0]!.label).toBe("Bride with her mother");
  expect(store().doc.event.coupleNames).toBe("Charis & Jacob");
  expect((store().raw as Record<string, unknown>)["photobooth"]).toEqual({
    props: ["top hat"],
    hours: 3,
  });
});

test("what is stored is what is restored — the whole document, not a summary", async () => {
  buildAWedding();
  await flushPersist();

  const stored = db.get(STORAGE_KEY) as Record<string, unknown>;
  for (const slice of ["event", "guests", "seating", "timeline", "day", "crew", "shots"]) {
    expect(stored[slice], `${slice} reached storage`).toBeDefined();
  }
});

test("a seated guest and their table never disagree about where they sit", () => {
  buildAWedding();
  const guest = readGuests(store().doc)["g1"]!;
  const table = Object.values(readSeating(store().doc).tables)[0]!;

  expect(guest.assignedTableId).toBe(table.id);
  expect(table.assignedGuestIds).toContain(guest.id);
});

test("a wedding's venue has no place until one is entered, and keeps the one that is", () => {
  const fresh = emptyKnotwork();
  expect(readTimeline(fresh).day).toMatchObject({ latitude: null, longitude: null });

  const placed = { ...fresh, timeline: { day: { latitude: 55.9533, longitude: -3.1883 } } } as typeof fresh;
  expect(readTimeline(placed).day).toMatchObject({ latitude: 55.9533, longitude: -3.1883 });
});
