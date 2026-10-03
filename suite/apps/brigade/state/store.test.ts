import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { default: sampleDay } = await import("../fixtures/sample-day.day.json");
const { sampleDoc } = await import("../core/model/defaults");
const { crewSlice } = await import("./sliceBridge");
const { brigadeDoc, useStore } = await import("./store");

const state = () => useStore.getState();
const doc = () => brigadeDoc(useKnotworkStore.getState().doc);

describe("the store", () => {
  beforeEach(() => {
    const raw = { ...emptyKnotwork(), crew: crewSlice(sampleDoc()), day: sampleDay } as Record<string, unknown>;
    useKnotworkStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
  });

  it("puts a person on a job and takes them off again", () => {
    state().toggleAssignment("job-glasses", "per-joe");
    expect(doc().jobs.find((job) => job.id === "job-glasses")?.personIds).toEqual(["per-joe"]);

    state().toggleAssignment("job-glasses", "per-joe");
    expect(doc().jobs.find((job) => job.id === "job-glasses")?.personIds).toEqual([]);
  });

  it("undoes an assignment", () => {
    state().toggleAssignment("job-glasses", "per-joe");
    useKnotworkStore.getState().undo();
    expect(doc().jobs.find((job) => job.id === "job-glasses")?.personIds).toEqual([]);
  });

  it("keeps the work when a team goes, and lets its people go loose", () => {
    const caterer = doc().teams.find((team) => team.tag === "caterer");
    state().deleteTeam(caterer?.id ?? "");

    expect(doc().jobs.find((job) => job.id === "job-covers")).toBeDefined();
    expect(doc().jobs.find((job) => job.id === "job-covers")?.teamId).toBeNull();
    expect(doc().people.find((person) => person.id === "per-ana")?.teamId).toBeNull();
  });

  it("takes a deleted person off every job they held", () => {
    state().deletePerson("per-ana");
    expect(doc().jobs.some((job) => job.personIds.includes("per-ana"))).toBe(false);
    expect(doc().jobs.find((job) => job.id === "job-covers")?.personIds).toEqual(["per-sam"]);
  });
});
