import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { changeTeam } = await import("@/lib/money/edit");
const { delegationDoc, useStore } = await import("./store");

/*
 * Delegation holds no copy of the wedding: it reads the crew and the day from
 * the one document, and every edit lands there at once, on the one history.
 */
type Raw = Record<string, any>;
const example: Raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const photographer = (example.crew.teams as Raw[]).find((team) => team.tag === "photographer")!.id as string;

const shared = () => useKnotworkStore.getState();
const storedTeams = () => (shared().raw as Raw).crew.teams as Raw[];

beforeEach(() => {
  useKnotworkStore.setState({ status: "ready", raw: example, doc: migrate(example), past: [], future: [] });
  useStore.setState({ selectedJobId: null });
});

test("an edit is in the wedding the moment it is made", () => {
  const id = useStore.getState().addTeam({ name: "Harp and strings" });
  expect(storedTeams().find((team) => team.id === id)?.name).toBe("Harp and strings");
});

test("a change made elsewhere is what Delegation shows, and its next edit keeps it", () => {
  shared().setSlice("crew", changeTeam(example.crew, photographer, { cost: 2400 }), { label: "a team's money" });
  expect(delegationDoc(shared().doc).teams.find((team) => team.id === photographer)?.cost).toBe(2400);

  useStore.getState().updateTeam(photographer, { phone: "07700 900123" });
  const stored = storedTeams().find((team) => team.id === photographer)!;
  expect([stored.cost, stored.phone]).toEqual([2400, "07700 900123"]);
});

test("the header's undo takes a Delegation edit back", () => {
  const job = (example.crew.jobs as Raw[]).find((entry) => entry.blockId !== null)!;
  const person = (example.crew.people as Raw[]).find((entry) => !job.personIds.includes(entry.id))!;
  useStore.getState().toggleAssignment(job.id, person.id);
  expect(shared().past.at(-1)?.label).toBe("who is on a job");

  shared().undo();
  expect(((shared().raw as Raw).crew.jobs as Raw[]).find((entry) => entry.id === job.id)!.personIds).toEqual(job.personIds);
});

test("the day is read from the wedding, so a moved block moves the job with it", () => {
  const before = delegationDoc(shared().doc).day;
  expect(before?.blocks.length).toBeGreaterThan(0);
  const day = example.day as Raw;
  const moved = { ...day, blocks: (day.blocks as Raw[]).map((block, i) => (i === 0 ? { ...block, label: "Moved" } : block)) };
  shared().setSlice("day", moved, { silent: true });
  expect(delegationDoc(shared().doc).day?.blocks[0]?.label).toBe("Moved");
});

test("the view is the same object until the wedding changes", () => {
  expect(delegationDoc(shared().doc)).toBe(delegationDoc(shared().doc));
});
