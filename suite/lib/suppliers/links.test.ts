import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { useSupplierLinks, changedSinceConfirmed } = await import("./links");
const { memoryStore } = await import("./store");
const { importShareKey, unseal } = await import("@/lib/share/crypto");
const { migrate } = await import("@jfrusher/trousseau");
const { localDay } = await import("@/lib/dates");

/*
 * The account's side, with the database's rules (proved in migrations.test.ts):
 * members read every link with its key; a republish under another key changes
 * nothing.
 */
const WEDDING = "w1";
let server = memoryStore();
const puts = vi.fn();
vi.stubGlobal(
  "fetch",
  vi.fn(async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET") return Response.json({ links: await server.linksOf(WEDDING) });
    const { weddingId: _, ...body } = JSON.parse(String(init!.body));
    if (method === "DELETE") {
      await server.takeDown(WEDDING, body.teamId);
      return Response.json({});
    }
    puts(body);
    const published = await server.publish(WEDDING, body);
    return published ? Response.json(published) : Response.json({ error: "elsewhere" }, { status: 409 });
  }) as unknown as typeof fetch,
);

type Raw = Record<string, any>;
const example: Raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.trousseau.json"), "utf8"));
const PHOTO = (example.crew.teams as Raw[]).find((team) => team.tag === "photographer")!.id as string;
const theirJob = (example.crew.jobs as Raw[]).find((job) => job.teamId === PHOTO)!.id as string;

const withCrew = (change: (crew: Raw) => Raw): Raw => ({ ...example, crew: change(example.crew) });
const relabelled = (label: string) =>
  withCrew((crew) => ({ ...crew, jobs: (crew.jobs as Raw[]).map((job) => (job.id === theirJob ? { ...job, label } : job)) }));
const open = (raw: Raw) => useTrousseauStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
const storedTeams = () => (useTrousseauStore.getState().raw as Raw).crew.teams as Raw[];

async function whatTheySee(teamId: string) {
  const link = (await server.linksOf(WEDDING)).find((entry) => entry.teamId === teamId)!;
  const sealed = (await server.read(link.token))!;
  return (await unseal(await importShareKey(link.key), sealed)) as { jobs: Array<{ label: string }> };
}

beforeEach(() => {
  server = memoryStore();
  puts.mockClear();
  useSupplierLinks.setState({ weddingId: WEDDING, links: [], problem: null });
});

test("a published link republishes itself when their job changes — same link, new sheet", async () => {
  open(example);
  await useSupplierLinks.getState().publish(PHOTO);
  const first = useSupplierLinks.getState().links![0]!;
  expect((await whatTheySee(PHOTO)).jobs[0]!.label).toBe("Photograph the ceremony");

  open(relabelled("Photograph the vows"));
  await useSupplierLinks.getState().keepCurrent();

  const again = useSupplierLinks.getState().links![0]!;
  expect([again.token, again.key]).toEqual([first.token, first.key]);
  expect((await whatTheySee(PHOTO)).jobs[0]!.label).toBe("Photograph the vows");
});

test("a change the supplier cannot see publishes nothing", async () => {
  open(example);
  await useSupplierLinks.getState().publish(PHOTO);
  puts.mockClear();

  const guestId = Object.keys(example.guests)[0]!;
  open({ ...example, guests: { ...example.guests, [guestId]: { ...example.guests[guestId], dietary: "No nuts" } } });
  await useSupplierLinks.getState().keepCurrent();
  expect(puts).not.toHaveBeenCalled();
});

test("their confirmation lands on the wedding as the day they confirmed — and is not an undo step", async () => {
  open(withCrew((crew) => ({ ...crew, teams: (crew.teams as Raw[]).map((team) => ({ ...team, confirmedOn: "" })) })));
  await useSupplierLinks.getState().publish(PHOTO);
  const confirmedAt = (await server.confirm(useSupplierLinks.getState().links![0]!.token))!;

  await useSupplierLinks.getState().load(WEDDING);

  const teams = storedTeams();
  expect(teams.find((team) => team.id === PHOTO)!.confirmedOn).toBe(localDay(new Date(confirmedAt)));
  expect(teams.filter((team) => team.id !== PHOTO).every((team) => team.confirmedOn === "")).toBe(true);
  expect(useTrousseauStore.getState().past).toEqual([]);
});

test("a later date typed in by hand stays", async () => {
  open(withCrew((crew) => ({ ...crew, teams: (crew.teams as Raw[]).map((team) => ({ ...team, confirmedOn: "2099-01-01" })) })));
  await useSupplierLinks.getState().publish(PHOTO);
  await server.confirm(useSupplierLinks.getState().links![0]!.token);

  await useSupplierLinks.getState().load(WEDDING);
  expect(storedTeams().find((team) => team.id === PHOTO)!.confirmedOn).toBe("2099-01-01");
});

test("a sheet republished after they confirmed says so", async () => {
  open(example);
  await useSupplierLinks.getState().publish(PHOTO);
  await server.confirm(useSupplierLinks.getState().links![0]!.token);
  await useSupplierLinks.getState().load(WEDDING);
  expect(changedSinceConfirmed(useSupplierLinks.getState().links![0]!)).toBe(false);

  await new Promise((resolve) => setTimeout(resolve, 5));
  open(relabelled("Photograph the vows"));
  await useSupplierLinks.getState().keepCurrent();
  expect(changedSinceConfirmed(useSupplierLinks.getState().links![0]!)).toBe(true);
});

test("a supplier removed from the wedding has their link taken down", async () => {
  open(example);
  await useSupplierLinks.getState().publish(PHOTO);
  const { token } = useSupplierLinks.getState().links![0]!;

  open(withCrew((crew) => ({ ...crew, teams: (crew.teams as Raw[]).filter((team) => team.id !== PHOTO) })));
  await useSupplierLinks.getState().keepCurrent();
  expect(await server.read(token)).toBeNull();
  expect(useSupplierLinks.getState().links).toEqual([]);
});

test("when another device published first, this one seals with that device's key", async () => {
  open(example);
  await server.publish(WEDDING, { teamId: PHOTO, key: "k".repeat(43), ciphertext: "x", iv: "y", fingerprint: "z" });

  await useSupplierLinks.getState().publish(PHOTO);
  expect(useSupplierLinks.getState().problem).toBeNull();
  expect(useSupplierLinks.getState().links![0]!.key).toBe("k".repeat(43));
});
