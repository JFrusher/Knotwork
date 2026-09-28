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
  weddingId: "w1",
  document: null as Record<string, unknown> | null,
  version: 0,
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
  fetchCloudDocument: async () =>
    server.reachable
      ? { ok: true, document: structuredClone(server.document), version: server.version, weddingId: server.weddingId }
      : { ok: false, reason: server.offline ? "unreachable" : "unavailable" },
  pushDocument: (document: unknown, expectedVersion: number) =>
    server.offline ? { ok: false, reason: "queued" } : pushDocumentMock(document, expectedVersion),
}));
vi.mock("@/lib/documents/assets", () => ({ syncAssets: async () => ({ uploaded: 0, downloaded: 0 }) }));

const { useTrousseauStore, flushPersist, STORAGE_KEY } = await import("./useTrousseauStore");
const { COPIES_KEY } = await import("./copies");
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
  Object.assign(server, { reachable: true, offline: false, weddingId: "w1", document: null, version: 0 });
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
