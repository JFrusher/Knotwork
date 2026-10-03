import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => undefined,
  del: async () => undefined,
}));

const pushDocumentMock = vi.fn();
const fetchCloudDocumentMock = vi.fn();
const fetchWeddingsMock = vi.fn();
vi.mock("@/lib/documents/cloudSync", () => ({
  fetchWeddings: () => fetchWeddingsMock(),
  fetchCloudDocument: (...args: unknown[]) => fetchCloudDocumentMock(...args),
  pushDocument: (...args: unknown[]) => pushDocumentMock(...args),
  readLink: async () => null,
  writeLink: async () => undefined,
}));
vi.mock("./openWedding", () => ({ readOpenChoice: async () => null }));

// Mocked rather than left to run: the real module reaches for browserClient
// and IndexedDB, and *when* it is called is the assertion in two tests below.
const syncAssetsMock = vi.fn(async (_weddingId: string) => ({ uploaded: 0, downloaded: 0 }));
vi.mock("@/lib/documents/assets", () => ({
  syncAssets: (weddingId: string) => syncAssetsMock(weddingId),
}));

const { useKnotworkStore, flushPersist } = await import("./useKnotworkStore");
const { emptyKnotwork } = await import("@jfrusher/knotwork");
const { fingerprintParts } = await import("@/lib/documents/mergeCloudDocument");
const { fingerprint } = await import("@/lib/documents/fingerprint");

/** Long enough for the 250ms cloud-push timer, and the push it ends in, to run. */
const PAST_THE_PERSIST_DELAY_MS = 400;
const settle = () => new Promise((resolve) => setTimeout(resolve, PAST_THE_PERSIST_DELAY_MS));

// resolveConflict and replaceDocument both schedule a real, un-awaited
// cloud-push timer. Left pending, it fires mid-way through a later test with
// whatever mock the *next* test happened to configure - flushing it here
// cancels that timer before it can fire against a stale mock.
afterEach(async () => {
  await flushPersist();
});

beforeEach(() => {
  pushDocumentMock.mockReset();
  fetchCloudDocumentMock.mockReset();
  fetchWeddingsMock.mockReset();
  // The couple's own wedding, and nothing else: which wedding to open is
  // tested with the rest of signing in, in signingIn.test.ts.
  fetchWeddingsMock.mockResolvedValue({ ok: true, weddings: [{ weddingId: "w1", role: "partner", names: "", date: "" }] });
  syncAssetsMock.mockClear();
  const doc = emptyKnotwork();
  useKnotworkStore.setState({
    status: "ready",
    error: null,
    raw: doc as unknown as Record<string, unknown>,
    doc,
    past: [],
    future: [],
    cloudStatus: "disabled",
    cloudVersion: null,
    cloudConflicts: [],
    cloudAgreed: {},
    cloudError: null,
    weddingId: "w1",
    cloudChoice: null,
  });
});

test("startCloudSync stays disabled when the cloud reports unavailable", async () => {
  fetchWeddingsMock.mockResolvedValue({ ok: false, reason: "unavailable" });
  await useKnotworkStore.getState().startCloudSync();
  expect(useKnotworkStore.getState().cloudStatus).toBe("disabled");
});

test("startCloudSync adopts the cloud document without creating an undo entry", async () => {
  fetchCloudDocumentMock.mockResolvedValue({ ok: true, weddingId: "w1", document: emptyKnotwork(), version: 4 });
  await useKnotworkStore.getState().startCloudSync();
  const state = useKnotworkStore.getState();
  expect(state.cloudStatus).toBe("idle");
  expect(state.cloudVersion).toBe(4);
  expect(state.past).toEqual([]);
  expect(Object.keys(state.cloudAgreed).length).toBeGreaterThan(0);
});

test("a rejected write surfaces per-slice conflicts, not an auto-merge", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: { ...base, event: { coupleNames: "mine" } },
  });
  pushDocumentMock.mockResolvedValue({
    ok: false,
    reason: "conflict",
    version: 2,
    document: { ...base, event: { coupleNames: "theirs" } },
  });
  await useKnotworkStore.getState().syncToCloud();
  const state = useKnotworkStore.getState();
  expect(state.cloudStatus).toBe("conflict");
  expect(state.cloudConflicts).toEqual([
    { key: "event", slice: "event", mine: { coupleNames: "mine" }, theirs: { coupleNames: "theirs" } },
  ]);
  // The conflicting slice keeps the local value until resolved.
  expect((state.raw as Record<string, unknown>).event).toEqual({ coupleNames: "mine" });
});

test("a rejected write with no actual slice overlap resolves itself and re-pushes", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: { ...base, guests: { g1: { id: "g1" } } },
  });
  pushDocumentMock
    .mockResolvedValueOnce({
      ok: false,
      reason: "conflict",
      version: 2,
      document: { ...base, seating: { t1: { id: "t1" } } },
    })
    .mockResolvedValueOnce({ ok: true, version: 3, warnings: [] });

  await useKnotworkStore.getState().syncToCloud();

  const state = useKnotworkStore.getState();
  expect(state.cloudConflicts).toEqual([]);
  expect(state.cloudStatus).toBe("idle");
  expect(state.cloudVersion).toBe(3);
  expect((state.raw as Record<string, unknown>).guests).toEqual({ g1: { id: "g1" } });
  expect((state.raw as Record<string, unknown>).seating).toEqual({ t1: { id: "t1" } });
  expect(pushDocumentMock).toHaveBeenCalledTimes(2);
});

test("resolveConflict(theirs) applies the server's slice and clears that conflict", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "conflict",
    cloudVersion: 2,
    cloudAgreed: fingerprintParts(base),
    cloudConflicts: [{ key: "event", slice: "event", mine: { coupleNames: "mine" }, theirs: { coupleNames: "theirs" } }],
    raw: { ...base, event: { coupleNames: "mine" } },
  });

  useKnotworkStore.getState().resolveConflict("event", "theirs");

  const state = useKnotworkStore.getState();
  expect(state.cloudConflicts).toEqual([]);
  expect((state.raw as Record<string, unknown>).event).toEqual({ coupleNames: "theirs" });
});

test("resolveConflict(mine) drops the conflict and keeps the local slice", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "conflict",
    cloudVersion: 2,
    cloudAgreed: fingerprintParts(base),
    cloudConflicts: [{ key: "event", slice: "event", mine: { coupleNames: "mine" }, theirs: { coupleNames: "theirs" } }],
    raw: { ...base, event: { coupleNames: "mine" } },
  });

  useKnotworkStore.getState().resolveConflict("event", "mine");

  const state = useKnotworkStore.getState();
  expect(state.cloudConflicts).toEqual([]);
  expect((state.raw as Record<string, unknown>).event).toEqual({ coupleNames: "mine" });
});

test("pullFromCloud takes a slice that only changed on the server", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: base,
  });
  fetchCloudDocumentMock.mockResolvedValue({
    ok: true,
    weddingId: "w1",
    document: { ...base, guests: { g1: { id: "g1" } } },
    version: 2,
  });
  // A clean pull with nothing left in conflict re-pushes to confirm the
  // merge (fire-and-forget, see pullFromCloud) - same version back, so the
  // assertion below holds regardless of whether that push lands before it.
  pushDocumentMock.mockResolvedValue({ ok: true, version: 2, warnings: [] });

  await useKnotworkStore.getState().pullFromCloud();

  const state = useKnotworkStore.getState();
  expect((state.raw as Record<string, unknown>).guests).toEqual({ g1: { id: "g1" } });
  expect(state.cloudVersion).toBe(2);
  expect(state.cloudConflicts).toEqual([]);
});

test("a partner's change to one guest and this device's to another both stand, with nothing to choose", async () => {
  const guests = { ada: { id: "ada", firstName: "Ada", rsvpStatus: "pending" }, alan: { id: "alan", firstName: "Alan", rsvpStatus: "pending" } };
  const base = { ...(emptyKnotwork() as unknown as Record<string, unknown>), guests };
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: { ...base, guests: { ...guests, ada: { ...guests.ada, rsvpStatus: "confirmed" } } },
  });
  fetchCloudDocumentMock.mockResolvedValue({
    ok: true,
    weddingId: "w1",
    document: { ...base, guests: { ...guests, alan: { ...guests.alan, rsvpStatus: "declined" } } },
    version: 2,
  });
  pushDocumentMock.mockResolvedValue({ ok: true, version: 3, warnings: [] });

  await useKnotworkStore.getState().pullFromCloud();

  const state = useKnotworkStore.getState();
  expect(state.cloudConflicts).toEqual([]);
  expect(state.cloudStatus).not.toBe("conflict");
  expect((state.raw as { guests: typeof guests }).guests).toMatchObject({
    ada: { rsvpStatus: "confirmed" },
    alan: { rsvpStatus: "declined" },
  });
  // Both edits go up together.
  await vi.waitFor(() => expect(pushDocumentMock).toHaveBeenCalled());
  const pushed = pushDocumentMock.mock.calls.at(-1)![1] as { guests: typeof guests };
  expect(pushed.guests).toMatchObject({ ada: { rsvpStatus: "confirmed" }, alan: { rsvpStatus: "declined" } });
});

test("pullFromCloud does nothing when the server version hasn't moved", async () => {
  const raw = useKnotworkStore.getState().raw;
  useKnotworkStore.setState({ cloudStatus: "idle", cloudVersion: 5 });
  // fetchCloudDocument has no way to report a version without a round trip,
  // so pullFromCloud always calls it - the "hasn't moved" short-circuit is
  // the version-equality check right after the response comes back.
  fetchCloudDocumentMock.mockResolvedValue({ ok: true, weddingId: "w1", document: raw, version: 5 });
  await useKnotworkStore.getState().pullFromCloud();
  const state = useKnotworkStore.getState();
  expect(state.cloudVersion).toBe(5);
  expect(state.raw).toEqual(raw);
});

test("syncToCloud does nothing at all while cloud sync is disabled", async () => {
  await useKnotworkStore.getState().syncToCloud();
  expect(pushDocumentMock).not.toHaveBeenCalled();
  expect(useKnotworkStore.getState().cloudStatus).toBe("disabled");
});

test("startCloudSync pushes the local wedding up on first sign-in, when the cloud has nothing yet", async () => {
  // The bug this covers: a wedding built entirely offline, then signed into.
  // fetchCloudDocument correctly reports `document: null` -- nothing has ever
  // been saved for this account -- and startCloudSync used to just go idle,
  // leaving the local wedding stranded until the next edit. Exporting from
  // the account page then answered "Nothing has been saved to your account
  // yet.", which was true of the server and false of what the user actually
  // had open.
  const guests = { g1: { id: "g1", firstName: "Charis" } };
  useKnotworkStore.setState((state) => ({
    raw: { ...state.raw, guests },
    doc: { ...state.doc, guests } as never,
  }));

  fetchCloudDocumentMock.mockResolvedValue({ ok: true, weddingId: "w1", document: null, version: 0 });
  pushDocumentMock.mockResolvedValue({ ok: true, version: 1, warnings: [] });

  await useKnotworkStore.getState().startCloudSync();

  expect(pushDocumentMock).toHaveBeenCalledWith(
    "w1",
    expect.objectContaining({ guests }),
    0,
  );
  expect(useKnotworkStore.getState().cloudStatus).toBe("idle");
  expect(useKnotworkStore.getState().cloudVersion).toBe(1);
  expect(Object.keys(useKnotworkStore.getState().cloudAgreed).length).toBeGreaterThan(0);
});

/**
 * The one test that crosses every task boundary this feature was built
 * across: the store's conflict handling, the real 250ms cloud-push
 * timer, and `toolGeneration`'s remount signal.
 *
 * Deliberately on real timers. Both bugs it covers lived *in* the timer:
 * every existing test either flushed it away or never reached it, so a
 * conflict that quietly resolved itself as "keep mine" a quarter of a second
 * after being surfaced went unnoticed through seven task reviews.
 */
test("a surfaced conflict pushes nothing until it is resolved, then pushes the resolved value", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: { ...base, event: { coupleNames: "mine" } },
  });
  pushDocumentMock.mockResolvedValue({
    ok: false,
    reason: "conflict",
    version: 2,
    document: { ...base, event: { coupleNames: "theirs" } },
  });

  await useKnotworkStore.getState().syncToCloud();
  expect(useKnotworkStore.getState().cloudStatus).toBe("conflict");
  expect(pushDocumentMock).toHaveBeenCalledTimes(1);

  // The conflict path calls replaceDocument, which schedules a persist, which
  // ends in a push. Let it run.
  await settle();

  expect(pushDocumentMock).toHaveBeenCalledTimes(1);
  expect(useKnotworkStore.getState().cloudStatus).toBe("conflict");
  expect(useKnotworkStore.getState().cloudConflicts).toEqual([
    { key: "event", slice: "event", mine: { coupleNames: "mine" }, theirs: { coupleNames: "theirs" } },
  ]);
  expect((useKnotworkStore.getState().raw as Record<string, unknown>).event).toEqual({
    coupleNames: "mine",
  });

  pushDocumentMock.mockResolvedValue({ ok: true, version: 3, warnings: [] });
  useKnotworkStore.getState().resolveConflict("event", "theirs");

  await settle();

  expect(pushDocumentMock).toHaveBeenCalledTimes(2);
  expect(pushDocumentMock.mock.calls[1][1]).toMatchObject({
    event: { coupleNames: "theirs" },
  });
  expect(useKnotworkStore.getState().cloudStatus).toBe("idle");
});

test("pullFromCloud waits for a baseline instead of merging against an empty one", async () => {
  // Where startCloudSync leaves things when its first fetch was unreachable.
  // With nothing agreed, every slice reads as changed-on-both-sides.
  useKnotworkStore.setState({ cloudStatus: "error", cloudVersion: null, cloudAgreed: {} });

  await useKnotworkStore.getState().pullFromCloud();

  expect(fetchCloudDocumentMock).not.toHaveBeenCalled();
  expect(useKnotworkStore.getState().cloudConflicts).toEqual([]);
});

test("pullFromCloud merges against the document as it is when the fetch lands", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: base,
  });
  fetchCloudDocumentMock.mockImplementation(async () => {
    // The user types while the request is in flight. Merging against the
    // snapshot taken before the fetch discards this, and then pushes the
    // discard.
    useKnotworkStore.setState({
      raw: { ...useKnotworkStore.getState().raw, event: { coupleNames: "typed mid-fetch" } },
    });
    return { ok: true, weddingId: "w1", document: { ...base, guests: { g1: { id: "g1" } } }, version: 2 };
  });
  pushDocumentMock.mockResolvedValue({ ok: true, version: 3, warnings: [] });

  await useKnotworkStore.getState().pullFromCloud();

  const raw = useKnotworkStore.getState().raw as Record<string, unknown>;
  expect(raw.event).toEqual({ coupleNames: "typed mid-fetch" });
  expect(raw.guests).toEqual({ g1: { id: "g1" } });
});

test("a pull that brings back nothing new neither replaces the document nor pushes", async () => {
  // Two tabs open: this is our own write coming back at a moved version.
  // Replacing anyway hands every page a new document for nothing, and pushing
  // it back is what made the two tabs bounce the document between them forever.
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: base,
  });
  fetchCloudDocumentMock.mockResolvedValue({ ok: true, weddingId: "w1", document: base, version: 2 });

  await useKnotworkStore.getState().pullFromCloud();

  expect(pushDocumentMock).not.toHaveBeenCalled();
  expect(useKnotworkStore.getState().raw).toBe(base);
  expect(useKnotworkStore.getState().cloudVersion).toBe(2);
});

test("a successful push records agreement on what was pushed, not on a later edit", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: { ...base, event: { coupleNames: "pushed" } },
  });
  pushDocumentMock.mockImplementation(async () => {
    // Typed while the push is in flight — the server never saw this.
    useKnotworkStore.setState({
      raw: { ...useKnotworkStore.getState().raw, event: { coupleNames: "typed during the push" } },
    });
    return { ok: true, version: 2, warnings: [] };
  });

  await useKnotworkStore.getState().syncToCloud();

  // Recording the newer value as agreed would make the next merge read this
  // slice as unchanged here, and silently take the partner's value over it.
  expect(useKnotworkStore.getState().cloudAgreed.event).toBe(
    fingerprint({ coupleNames: "pushed" }),
  );
});

test("assets sync on a pull, not on every document push", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(base),
    raw: base,
    weddingId: "w1",
  });
  pushDocumentMock.mockResolvedValue({ ok: true, version: 2, warnings: [] });

  // A push happens after every debounced edit burst. Fonts and artwork only
  // change on upload, so listing the bucket and reading every blob out of
  // IndexedDB here costs a round trip per keystroke burst for nothing.
  await useKnotworkStore.getState().syncToCloud();
  expect(syncAssetsMock).not.toHaveBeenCalled();

  fetchCloudDocumentMock.mockResolvedValue({
    ok: true,
    weddingId: "w1",
    document: { ...base, guests: { g1: { id: "g1" } } },
    version: 3,
  });
  await useKnotworkStore.getState().pullFromCloud();
  expect(syncAssetsMock).toHaveBeenCalledWith("w1");
});

test("a pull refused for a wedding this account was taken off hands the decision back to a start", async () => {
  const base = emptyKnotwork() as unknown as Record<string, unknown>;
  const mine = { ...base, guests: { r1: { id: "r1", firstName: "Robin" } } };
  useKnotworkStore.setState({
    cloudStatus: "idle",
    cloudVersion: 1,
    cloudAgreed: fingerprintParts(mine),
    raw: mine,
    weddingId: "w1",
  });
  fetchCloudDocumentMock.mockResolvedValue({ ok: false, reason: "unavailable" });
  fetchWeddingsMock.mockResolvedValue({ ok: true, weddings: [] });

  await useKnotworkStore.getState().pullFromCloud();

  // Nothing left to sync with, and nothing on the device touched.
  expect(useKnotworkStore.getState().cloudStatus).toBe("disabled");
  expect(Object.keys(useKnotworkStore.getState().raw["guests"] as object)).toEqual(["r1"]);
});

test("startCloudSync does not push an empty wedding on first sign-in", async () => {
  // Nothing to lose here, and pushing an empty document would still be
  // correct -- but skipping it is one fewer network round trip for the
  // overwhelmingly common case of a brand-new account.
  fetchCloudDocumentMock.mockResolvedValue({ ok: true, weddingId: "w1", document: null, version: 0 });

  await useKnotworkStore.getState().startCloudSync();

  expect(pushDocumentMock).not.toHaveBeenCalled();
  expect(useKnotworkStore.getState().cloudStatus).toBe("idle");
});
