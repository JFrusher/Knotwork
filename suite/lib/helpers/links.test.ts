// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { readCrew } from "@/lib/model/slices";
import { helperSheet } from "./helperSheet";
import { fingerprint } from "@/lib/documents/fingerprint";
import * as crypto from "@/lib/share/crypto";
import { memoryStore, type HelperLink } from "./store";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { useHelperLinks } = await import("./links");
const doc = migrate(JSON.parse(readFileSync(join(process.cwd(), "public/fixtures/example-wedding.knotwork.json"), "utf8")));
const personId = readCrew(doc).people[0]!.id;
const link: HelperLink = { personId, token: "old", key: "k".repeat(43), fingerprint: "old", publishedAt: "2026-10-07T12:00:00Z" };
const deferred = <T,>() => Promise.withResolvers<T>();
let server = memoryStore();
let fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  server = memoryStore();
  useKnotworkStore.setState({ weddingId: "w1", doc });
  useHelperLinks.setState({ weddingId: "w1", links: [], problem: null });
  fetchMock = vi.fn(async (url, init) => {
    if (!init) return Response.json({ links: await server.linksOf(new URL(String(url), "https://example.test").searchParams.get("wedding")!) });
    const { weddingId, ...body } = JSON.parse(String(init.body));
    if (init.method === "DELETE") {
      await server.takeDown(weddingId, body.personId);
      return Response.json({});
    }
    const result = await server.publish(weddingId, body);
    return result ? Response.json(result) : Response.json({ error: "conflict" }, { status: 409 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function holdRead() {
  const response = deferred<Response>();
  const started = deferred<void>();
  fetchMock.mockImplementationOnce(() => { started.resolve(); return response.promise; });
  return { response, started };
}

test.each([false, true])("superseded load cannot replace links or errors (failure: %s)", async (fail) => {
  const { response, started } = await holdRead();
  const first = useHelperLinks.getState().load("w1");
  await started.promise;
  useKnotworkStore.setState({ weddingId: "w2" });
  const second = useHelperLinks.getState().load("w2");
  if (fail) response.reject(new Error("old error"));
  else response.resolve(Response.json({ links: [link] }));
  await Promise.all([first, second]);
  expect(useHelperLinks.getState()).toMatchObject({ weddingId: "w2", links: [], problem: null });
});

test("keepCurrent stops after its read when the wedding changes, even away and back", async () => {
  const { response, started } = await holdRead();
  const keeping = useHelperLinks.getState().keepCurrent();
  await started.promise;
  useKnotworkStore.setState({ weddingId: "w2" });
  useKnotworkStore.setState({ weddingId: "w1" });
  response.resolve(Response.json({ links: [link] }));
  await keeping;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(useHelperLinks.getState().links).toBeUndefined();
});

test("a wedding switch during encryption prevents publishing to the prior wedding", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ links: [link] }));
  const sealed = deferred<Awaited<ReturnType<typeof crypto.seal>>>();
  const started = deferred<void>();
  vi.spyOn(crypto, "seal").mockImplementationOnce(() => { started.resolve(); return sealed.promise; });
  const keeping = useHelperLinks.getState().keepCurrent();
  await started.promise;
  useKnotworkStore.setState({ weddingId: "w2" });
  sealed.resolve({ ciphertext: "sealed", iv: "iv" });
  await keeping;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each(["publish", "takeDown", "load"] as const)("keepCurrent serializes with a later %s", async (operation) => {
  await server.publish("w1", { ...link, ciphertext: "sealed", iv: "iv" });
  const current = { ...(await server.linksOf("w1"))[0]!, fingerprint: fingerprint(helperSheet(doc, personId)) };
  const { response, started } = await holdRead();
  const keeping = useHelperLinks.getState().keepCurrent();
  await started.promise;
  const next = operation === "load" ? useHelperLinks.getState().load("w1") : useHelperLinks.getState()[operation](personId);
  response.resolve(Response.json({ links: [current] }));
  await Promise.all([keeping, next]);
  expect(useHelperLinks.getState().links).toEqual(await server.linksOf("w1"));
  if (operation === "takeDown") expect(useHelperLinks.getState().links).toEqual([]);
});

test("take down then republish during a refresh retains the new token and key", async () => {
  await useHelperLinks.getState().publish(personId);
  const old = useHelperLinks.getState().links![0]!;
  const { response, started } = await holdRead();
  const keeping = useHelperLinks.getState().keepCurrent();
  await started.promise;
  const removing = useHelperLinks.getState().takeDown(personId);
  const publishing = useHelperLinks.getState().publish(personId);
  response.resolve(Response.json({ links: [old] }));
  await Promise.all([keeping, removing, publishing]);
  const latest = useHelperLinks.getState().links![0]!;
  expect(latest.token).not.toBe(old.token);
  expect(latest.key).not.toBe(old.key);
  expect(useHelperLinks.getState().links).toEqual(await server.linksOf("w1"));
});

test("one conflict fetches the winning key and retries successfully", async () => {
  await server.publish("w1", { ...link, ciphertext: "sealed", iv: "iv" });
  await useHelperLinks.getState().publish(personId);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(useHelperLinks.getState()).toMatchObject({ problem: null, links: [{ key: link.key }] });
});

test.each([true, false])("a conflict stops after one retry or a missing link (found: %s)", async (found) => {
  fetchMock.mockImplementation(async (_url, init) => init
    ? Response.json({ error: "conflict" }, { status: 409 })
    : Response.json({ links: found ? [link] : [] }));
  await useHelperLinks.getState().publish(personId);
  expect(fetchMock).toHaveBeenCalledTimes(found ? 3 : 2);
  expect(useHelperLinks.getState().problem).toBe("The helper's link could not be published.");
});


test("a later load of the same wedding does not cancel a queued publish", async () => {
  const { response, started } = await holdRead();
  const first = useHelperLinks.getState().load("w1");
  await started.promise;
  const publishing = useHelperLinks.getState().publish(personId);
  const second = useHelperLinks.getState().load("w1");
  response.resolve(Response.json({ links: [link] }));
  await Promise.all([first, publishing, second]);
  expect(useHelperLinks.getState().links).toHaveLength(1);
  expect(useHelperLinks.getState().links).toEqual(await server.linksOf("w1"));
  expect(useHelperLinks.getState().links![0]!.token).not.toBe(link.token);
});
