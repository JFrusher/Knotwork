import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { guestView, useGuestLink } = await import("./guestLink");
const { memoryStore } = await import("./store");
const { importShareKey, unseal } = await import("./crypto");
const { emptyTrousseau, migrate } = await import("@jfrusher/trousseau");

/*
 * The account's side, with the database's rules (proved in migrations.test.ts):
 * members read the link with its key; a republish under another key changes
 * nothing.
 */
const WEDDING = "w1";
let server = memoryStore();
const puts = vi.fn();
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET") return Response.json({ link: await server.linkOf(WEDDING) });
    if (method === "DELETE") {
      await server.takeDown(WEDDING);
      return Response.json({});
    }
    const { weddingId: _, ...body } = JSON.parse(String(init!.body));
    puts(body);
    const published = await server.publish(WEDDING, body);
    return published ? Response.json(published) : Response.json({ error: "elsewhere" }, { status: 409 });
  }) as unknown as typeof fetch,
);

type Raw = Record<string, unknown>;
function wedding(seat: string, dietary = ""): Raw {
  const doc = emptyTrousseau();
  return {
    ...doc,
    event: { ...doc.event, coupleNames: "Alex & Sam" },
    guests: { g1: { id: "g1", firstName: "Ann", lastName: "Lee", rsvpStatus: "confirmed", dietary, assignedTableId: seat } },
    seating: {
      tables: {
        t1: { id: "t1", label: "Table 1", assignedGuestIds: seat === "t1" ? ["g1"] : [] },
        t2: { id: "t2", label: "Table 2", assignedGuestIds: seat === "t2" ? ["g1"] : [] },
      },
    },
  } as unknown as Raw;
}
const open = (raw: Raw) => useTrousseauStore.setState({ status: "ready", raw, doc: migrate(raw) });

async function whatGuestsSee() {
  const link = (await server.linkOf(WEDDING))!;
  const sealed = (await server.read(link.token))!;
  return (await unseal(await importShareKey(link.key), sealed)) as { guests: Array<{ name: string; table: string }> };
}

beforeEach(() => {
  server = memoryStore();
  puts.mockClear();
  useGuestLink.setState({ weddingId: WEDDING, link: null, problem: null });
});

test("what guests see is fingerprinted without the time it was published", () => {
  const doc = migrate(wedding("t1"));
  expect(guestView(doc, false).fingerprint).toBe(guestView(doc, false).fingerprint);
});

test("a published link republishes itself when a guest moves — same link, new table", async () => {
  open(wedding("t1"));
  await useGuestLink.getState().publish(false);
  const first = useGuestLink.getState().link!;
  expect((await whatGuestsSee()).guests).toEqual([{ name: "Ann Lee", table: "Table 1", seat: null }]);

  open(wedding("t2"));
  await useGuestLink.getState().keepCurrent();

  const again = useGuestLink.getState().link!;
  expect([again.token, again.key]).toEqual([first.token, first.key]);
  expect((await whatGuestsSee()).guests[0]!.table).toBe("Table 2");
});

test("a change guests cannot see publishes nothing", async () => {
  open(wedding("t1"));
  await useGuestLink.getState().publish(false);
  puts.mockClear();

  open(wedding("t1", "vegan"));
  await useGuestLink.getState().keepCurrent();
  expect(puts).not.toHaveBeenCalled();
});

test("when another device published first, this one seals with that device's key", async () => {
  open(wedding("t1"));
  // Another device got there first, under its own key.
  await server.publish(WEDDING, { key: "k".repeat(43), showPlan: false, ciphertext: "x", iv: "y", fingerprint: "z" });
  useGuestLink.setState({ link: null });

  await expect(useGuestLink.getState().publish(false)).resolves.toBeUndefined();
  expect(useGuestLink.getState().link!.key).toBe("k".repeat(43));
});

test("taking it down leaves nothing for a guest to read", async () => {
  open(wedding("t1"));
  await useGuestLink.getState().publish(false);
  const { token } = useGuestLink.getState().link!;
  await useGuestLink.getState().takeDown();
  expect(await server.read(token)).toBeNull();
  expect(useGuestLink.getState().link).toBeNull();
});
