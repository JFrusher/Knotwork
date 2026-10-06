// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Crew, Job } from "@/lib/model/types";
import { checklist, USUAL_TASKS, withUsualTasks } from "./checklist";

const task = (label: string, over: Partial<Job> = {}): Job => ({
  id: label,
  blockId: null,
  label,
  notes: "",
  teamId: null,
  personIds: [],
  status: "todo",
  dueOn: "",
  ...over,
});
const crew = (jobs: Job[]): Crew => ({ teams: [], people: [], jobs, budget: null, errandsDone: [] });

describe("the checklist", () => {
  it("sorts open tasks by when they are due, and keeps the day's jobs out of it", () => {
    const found = checklist(
      crew([
        task("Late", { dueOn: "2028-04-01" }),
        task("Soon", { dueOn: "2028-05-20" }),
        task("Far", { dueOn: "2028-09-01" }),
        task("Whenever"),
        task("Booked", { status: "done", dueOn: "2027-01-01" }),
        task("Rings", { blockId: "blk-rings" }),
      ]),
      "2028-05-01",
    );
    const labels = (jobs: Job[]) => jobs.map((job) => job.label);
    expect(labels(found.overdue)).toEqual(["Late"]);
    expect(labels(found.comingUp)).toEqual(["Soon"]);
    expect(labels(found.later)).toEqual(["Far"]);
    expect(labels(found.undated)).toEqual(["Whenever"]);
    expect(labels(found.done)).toEqual(["Booked"]);
  });
});

describe("the usual tasks", () => {
  it("dates each from the wedding's day", () => {
    const added = withUsualTasks(crew([]), "2028-06-01").jobs;
    expect(added).toHaveLength(USUAL_TASKS.length);
    expect(added.find((job) => job.label === "Book the venue")).toMatchObject({ blockId: null, dueOn: "2027-06-02", status: "todo" });
    expect(added.find((job) => job.label === "Print the place cards")?.dueOn).toBe("2028-05-25");
  });

  it("adds only what is not there yet, however it was written", () => {
    const added = withUsualTasks(crew([task("final numbers to the caterer")]), "2028-06-01").jobs;
    expect(added.filter((job) => job.label.toLowerCase() === "final numbers to the caterer")).toHaveLength(1);
    expect(withUsualTasks({ ...crew([]), jobs: added }, "2028-06-01").jobs).toHaveLength(added.length);
  });

  it("leaves them undated while there is no day", () => {
    expect(withUsualTasks(crew([]), "").jobs.every((job) => job.dueOn === "")).toBe(true);
  });
});
