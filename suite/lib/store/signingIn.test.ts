import { afterEach, beforeEach, expect, test, vi } from "vitest";

/*
 * Signing in, across reloads.
 *
 * IndexedDB is a Map here rather than a stub that always reads empty, so a
 * "reload" re-reads exactly what the last session stored — the only way to see
 * what survives one.
 */
const idb = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => structuredClone(idb.get(key)),
  set: async (key: string, value: unknown) => void idb.set(key, structuredClone(value)),
  del: async (key: string) => void idb.delete(key),
}));

const server = {
  reachable: true,
  offline: false,
  weddings: [{ weddingId: "w1", role: "partner" }] as Array<{ weddingId: string; role: string }>,
  weddingId: "w1",
  document: null as Record<string, unknown> | null,
  version: 0,
  /** Every other wedding the account is on, by id. */
  others: {} as Record<string, { document: Record<string, unknown> | null; version: number }>,
};
const pushDocumentMock = vi.fn(async (document: unknown, expectedVersion: number) => {
  if (expectedVersion !== server.version) {
    return { ok: false as const, reason: "conflict" as const, version: server.version, document: server.document };
  }
  server.document = structuredClone(document) as Record<string, unknown>;
  server.version += 1;
  return { ok: true as const, version: server.version, warnings: [] };
});
// The transport is faked; the link it stores is the real one, in the Map.
vi.mock("@/lib/documents/cloudSync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/documents/cloudSync")>()),
  fetchWeddings: async () =>
    server.reachable
      ? { ok: true, weddings: server.weddings.map((w) => ({ names: "", date: "", ...w })) }
      : { ok: false, reason: server.offline ? "unreachable" : "unavailable" },
  fetchCloudDocument: async (weddingId: string) => {
    if (!server.reachable) return { ok: false, reason: server.offline ? "unreachable" : "unavailable" };
    const held = weddingId === server.weddingId ? server : server.others[weddingId];
    return { ok: true, document: structuredClone(held?.document ?? null), version: held?.version ?? 0, weddingId };
  },
  pushDocument: async (weddingId: string, document: unknown, expectedVersion: number) => {
    if (server.offline) return { ok: false, reason: "queued" };
    if (weddingId === server.weddingId) return pushDocumentMock(document, expectedVersion);
    const held = (server.others[weddingId] ??= { document: null, version: 0 });
    if (expectedVersion !== held.version) return { ok: false, reason: "conflict", version: held.version, document: held.document };
    held.document = structuredClone(document) as Record<string, unknown>;
    held.version += 1;
    return { ok: true, version: held.version, warnings: [] };
  },
}));
vi.mock("@/lib/documents/assets", () => ({ syncAssets: async () => ({ uploaded: 0, downloaded: 0 }) }));

const { useTrousseauStore, flushPersist, STORAGE_KEY } = await import("./useTrousseauStore");
const { COPIES_KEY } = await import("./copies");
const { openWedding } = await import("./openWedding");
const { weddingToOpen } = await import("./useTrousseauStore");
const { emptyTrousseau } = await import("@jfrusher/trousseau");

type Raw = Record<string, unknown>;
const wedding = (couple: string, guests: Record<string, { id: string; firstName: string }>): Raw => {
  const doc = emptyTrousseau();
  return { ...doc, event: { ...doc.event, coupleNames: couple }, guests } as unknown as Raw;
};

/**
 * A fresh tab: nothing in memory, everything read back from storage.
 *
 * Nothing is flushed first — that would write this tab's in-memory document
 * over whatever a test just put in storage. Each session flushes its own
 * edits before it ends.
 */
async function reload() {
  const doc = emptyTrousseau();
  useTrousseauStore.setState({
    status: "idle",
    error: null,
    raw: doc as unknown as Raw,
    doc,
    past: [],
    future: [],
    cloudStatus: "disabled",
    cloudVersion: null,
    cloudAgreed: {},
    cloudConflicts: [],
    cloudError: null,
    weddingId: null,
    cloudChoice: null,
  });
  await useTrousseauStore.getState().hydrate();
  await useTrousseauStore.getState().startCloudSync();
  await flushPersist();
}

const guestsOnDevice = () => Object.keys((useTrousseauStore.getState().raw["guests"] ?? {}) as object);

beforeEach(() => {
  idb.clear();
  pushDocumentMock.mockClear();
  Object.assign(server, {
    reachable: true,
    offline: false,
    weddings: [{ weddingId: "w1", role: "partner" }],
    weddingId: "w1",
    document: null,
    version: 0,
    others: {},
  });
});

afterEach(async () => {
  await flushPersist();
});

test("signing in on a device with its own wedding does not replace it without asking", async () => {
  idb.set(STORAGE_KEY, wedding("Robin & Kit", { r1: { id: "r1", firstName: "Robin" } }));
  server.document = wedding("Alex & Sam", { a1: { id: "a1", firstName: "Alex" } });
  server.version = 7;

  await reload();

  expect(guestsOnDevice()).toEqual(["r1"]);
  expect((idb.get(STORAGE_KEY) as Raw)["guests"]).toHaveProperty("r1");
  expect(pushDocumentMock).not.toHaveBeenCalled();
  expect(useTrousseauStore.getState().cloudStatus).toBe("choosing");
});

async function twoWeddings() {
  idb.set(STORAGE_KEY, wedding("Robin & Kit", { r1: { id: "r1", firstName: "Robin" } }));
  server.document = wedding("Alex & Sam", { a1: { id: "a1", firstName: "Alex" } });
  server.version = 7;
  await reload();
}

const kept = () => (idb.get(COPIES_KEY) as Array<{ document: Raw }> | undefined) ?? [];

test("choosing the account's wedding keeps this device's as a copy", async () => {
  await twoWeddings();
  await useTrousseauStore.getState().chooseWedding("account");
  await flushPersist();

  expect(guestsOnDevice()).toEqual(["a1"]);
  expect(kept().map((copy) => Object.keys(copy.document["guests"] as object))).toEqual([["r1"]]);
  expect(pushDocumentMock).not.toHaveBeenCalled();
  expect(useTrousseauStore.getState().cloudStatus).toBe("idle");

  // And the device now knows it belongs to this wedding: no question next time.
  await reload();
  expect(useTrousseauStore.getState().cloudStatus).toBe("idle");
  expect(guestsOnDevice()).toEqual(["a1"]);
});

test("choosing this device's wedding keeps the account's as a copy, and sends this one up", async () => {
  await twoWeddings();
  await useTrousseauStore.getState().chooseWedding("device");
  await flushPersist();

  expect(kept().map((copy) => Object.keys(copy.document["guests"] as object))).toEqual([["a1"]]);
  expect(Object.keys(server.document!["guests"] as object)).toEqual(["r1"]);
  expect(server.version).toBe(8);

  await reload();
  expect(useTrousseauStore.getState().cloudStatus).toBe("idle");
  expect(guestsOnDevice()).toEqual(["r1"]);
});

test("if the account's wedding moved while the question was open, it is asked again about what it holds now", async () => {
  await twoWeddings();
  // The partner saves while this device is still deciding.
  server.document = wedding("Alex & Sam", { a1: { id: "a1", firstName: "Alex" }, a3: { id: "a3", firstName: "Jo" } });
  server.version = 8;

  await useTrousseauStore.getState().chooseWedding("device");

  const state = useTrousseauStore.getState();
  expect(state.cloudStatus).toBe("choosing");
  expect(Object.keys(state.cloudChoice!.document["guests"] as object)).toEqual(["a1", "a3"]);
  expect(state.cloudConflicts).toEqual([]);
  expect(guestsOnDevice()).toEqual(["r1"]);
});

test("keeping this device's wedding while the account is out of reach changes nothing, and keeps asking", async () => {
  await twoWeddings();
  server.offline = true;

  await useTrousseauStore.getState().chooseWedding("device");

  const state = useTrousseauStore.getState();
  expect(state.cloudStatus).toBe("choosing");
  expect(state.cloudError).toMatch(/nothing has changed/);
  expect(kept()).toEqual([]);
  expect(guestsOnDevice()).toEqual(["r1"]);
});

test("nothing is asked when this device has nothing to lose", async () => {
  server.document = wedding("Alex & Sam", { a1: { id: "a1", firstName: "Alex" } });
  server.version = 2;
  await reload();
  expect(useTrousseauStore.getState().cloudStatus).toBe("idle");
  expect(guestsOnDevice()).toEqual(["a1"]);
});

test("nothing is asked when the account has nothing to lose", async () => {
  idb.set(STORAGE_KEY, wedding("Robin & Kit", { r1: { id: "r1", firstName: "Robin" } }));
  await reload();
  expect(useTrousseauStore.getState().cloudStatus).toBe("idle");
  expect(Object.keys(server.document!["guests"] as object)).toEqual(["r1"]);
});

test("an edit made offline goes up on reconnect as a merge, not a conflict over everything", async () => {
  server.document = wedding("Alex & Sam", { a1: { id: "a1", firstName: "Alex" } });
  server.version = 3;
  await reload();

  server.offline = true;
  server.reachable = false;
  await reload();
  const guests = useTrousseauStore.getState().raw["guests"] as Raw;
  useTrousseauStore.getState().setSlice("guests", { ...guests, a2: { id: "a2", firstName: "Sam" } });
  await flushPersist();

  server.offline = false;
  server.reachable = true;
  await useTrousseauStore.getState().syncToCloud();

  expect(useTrousseauStore.getState().cloudStatus).toBe("idle");
  expect(Object.keys(server.document!["guests"] as object).sort()).toEqual(["a1", "a2"]);
});

test("an edit made while the account could not be reached survives the next sign-in", async () => {
  server.document = wedding("Alex & Sam", { a1: { id: "a1", firstName: "Alex" } });
  server.version = 3;
  await reload();
  expect(guestsOnDevice()).toEqual(["a1"]);

  server.reachable = false;
  await reload();
  const guests = useTrousseauStore.getState().raw["guests"] as Raw;
  useTrousseauStore.getState().setSlice("guests", { ...guests, a2: { id: "a2", firstName: "Sam" } });
  await flushPersist();

  server.reachable = true;
  await reload();

  expect(guestsOnDevice().sort()).toEqual(["a1", "a2"]);
});

// Many weddings --------------------------------------------------------------

const names = () => (useTrousseauStore.getState().raw["event"] as { coupleNames: string }).coupleNames;

function plannerWithClients() {
  server.weddings = [
    { weddingId: "c1", role: "planner" },
    { weddingId: "c2", role: "planner" },
  ];
  server.weddingId = "none";
  server.others = {
    c1: { document: wedding("Alex & Sam", { a1: { id: "a1", firstName: "Alex" } }), version: 3 },
    c2: { document: wedding("Robin & Kit", { r1: { id: "r1", firstName: "Robin" } }), version: 5 },
  };
}

test("which wedding opens: the one opened here, then the one last synced, then the couple's own, then the only one", () => {
  const link = { weddingId: "b", version: 1, agreed: {} };
  const list = (...ids: string[]) => ids.map((weddingId, i) => ({ weddingId, role: i === 0 ? ("partner" as const) : ("planner" as const), names: "", date: "" }));
  expect(weddingToOpen(list("a", "b", "c"), "c", link)).toBe("c");
  expect(weddingToOpen(list("a", "b", "c"), null, link)).toBe("b");
  expect(weddingToOpen(list("a", "b", "c"), "gone", null)).toBe("a");
  expect(weddingToOpen(list("a"), null, null)).toBe("a");
  expect(weddingToOpen(list("x", "y").map((w) => ({ ...w, role: "planner" as const })), null, null)).toBeNull();
});

test("a planner with several clients and none opened here is not handed one", async () => {
  plannerWithClients();
  await reload();
  expect(useTrousseauStore.getState().cloudStatus).toBe("disabled");
  expect(names()).toBe("");
});

test("opening a client's wedding brings it to this device", async () => {
  plannerWithClients();
  await reload();
  await openWedding("c2");
  await reload();
  expect(useTrousseauStore.getState().cloudStatus).toBe("idle");
  expect(names()).toBe("Robin & Kit");
});

test("switching between clients is a swap: each comes back exactly as it was, edits not yet sent included", async () => {
  plannerWithClients();
  await openWedding("c1");
  await reload();

  // An edit that never reached the account before the switch.
  server.offline = true;
  const guests = useTrousseauStore.getState().raw["guests"] as Raw;
  useTrousseauStore.getState().setSlice("guests", { ...guests, a2: { id: "a2", firstName: "Sam" } });
  await flushPersist();
  server.offline = false;

  await openWedding("c2");
  await reload();
  expect(names()).toBe("Robin & Kit");

  await openWedding("c1");
  await reload();
  expect(names()).toBe("Alex & Sam");
  expect(guestsOnDevice().sort()).toEqual(["a1", "a2"]);
  // And the edit went up once this wedding was open again.
  expect(Object.keys(server.others["c1"]!.document!["guests"] as object).sort()).toEqual(["a1", "a2"]);
  // Nothing was asked, and nothing was kept as a copy: a swap is not a replacement.
  expect(kept()).toEqual([]);
});

test("a wedding on this device that no account holds is asked about, not put aside, when another is opened", async () => {
  plannerWithClients();
  idb.set(STORAGE_KEY, wedding("Jo & Lee", { j1: { id: "j1", firstName: "Jo" } }));
  await openWedding("c1");
  await reload();
  expect(useTrousseauStore.getState().cloudStatus).toBe("choosing");
  expect(names()).toBe("Jo & Lee");
});
