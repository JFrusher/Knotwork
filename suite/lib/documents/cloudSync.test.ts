import { beforeEach, describe, expect, it, vi } from "vitest";

const idbStore = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => idbStore.get(key),
  set: async (key: string, value: unknown) => void idbStore.set(key, value),
  del: async (key: string) => void idbStore.delete(key),
}));

const { fetchCloudDocument, fetchWeddings, pushDocument, readLink, writeLink, forgetLink } = await import("./cloudSync");

beforeEach(() => {
  idbStore.clear();
  vi.restoreAllMocks();
});

describe("fetchCloudDocument", () => {
  it("returns the wedding, its document and version on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ weddingId: "w1", document: { event: {} }, version: 3 }), { status: 200 }),
      ),
    );
    const result = await fetchCloudDocument("w1");
    expect(result).toEqual({ ok: true, weddingId: "w1", document: { event: {} }, version: 3 });
  });

  it("reports not-reachable on a network failure, without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const result = await fetchCloudDocument("w1");
    expect(result).toEqual({ ok: false, reason: "unreachable" });
  });

  it("reports unavailable on a 501 (accounts not configured or no wedding yet)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 501 })));
    const result = await fetchCloudDocument("w1");
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("fetchWeddings", () => {
  it("lists the account's weddings", async () => {
    const weddings = [{ weddingId: "w1", role: "planner", names: "Alex & Sam", date: "2027-06-12" }];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ weddings }), { status: 200 })));
    expect(await fetchWeddings()).toEqual({ ok: true, weddings });
  });

  it("reports unavailable when signed out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    expect(await fetchWeddings()).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("every call names its wedding", () => {
  it("asks for the wedding it was given", async () => {
    const fetched = vi.fn(async (_url: string) => new Response(JSON.stringify({ weddingId: "w2", document: null, version: 0 }), { status: 200 }));
    vi.stubGlobal("fetch", fetched);
    await fetchCloudDocument("w2");
    expect(fetched.mock.calls[0]![0]).toBe("/api/documents?wedding=w2");
  });
});

describe("pushDocument", () => {
  it("succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ version: 1, warnings: [] }), { status: 200 })),
    );
    const result = await pushDocument("w1", { event: {} }, 0);
    expect(result).toEqual({ ok: true, version: 1, warnings: [] });
  });

  it("reports queued when the network is unreachable, and stores nothing of its own", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const result = await pushDocument("w1", { event: { coupleNames: "offline edit" } }, 2);
    expect(result).toEqual({ ok: false, reason: "queued" });
    // The change waits in the local document, which the next push carries.
    expect(idbStore.size).toBe(0);
  });

  it("surfaces a conflict without treating it as queueable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ version: 5, document: { event: { coupleNames: "theirs" } } }), {
            status: 409,
          }),
      ),
    );
    const result = await pushDocument("w1", { event: { coupleNames: "mine, but stale" } }, 4);
    expect(result).toEqual({ ok: false, reason: "conflict", version: 5, document: { event: { coupleNames: "theirs" } } });
  });

  it("surfaces a validation failure without queueing it for silent retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "That wedding is not valid.", errors: ["bad"] }), { status: 422 }),
      ),
    );
    const result = await pushDocument("w1", { event: {} }, 0);
    expect(result).toEqual({ ok: false, reason: "invalid", errors: ["bad"] });
  });
});

describe("the link", () => {
  it("remembers which wedding this device synced with, and what they agreed", async () => {
    expect(await readLink()).toBeNull();
    await writeLink({ weddingId: "w1", version: 4, agreed: { guests: "abc" } });
    expect(await readLink()).toEqual({ weddingId: "w1", version: 4, agreed: { guests: "abc" } });
    await forgetLink();
    expect(await readLink()).toBeNull();
  });
});
