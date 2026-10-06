import { newId } from "@/lib/model/ids";
import type { Crew, Job, JobStatus, Person, Team } from "@/lib/model/types";
import type { Timeline } from "@/lib/model/timeline";

/**
 * The work of the day, and the hands doing it.
 *
 * A job has no time of its own: it happens when its block happens and moves
 * when the block moves. That is the whole reason it stores a `blockId` and
 * nothing else about when — a job carrying its own clock time would drift out
 * of step with the timeline the first time anything moved.
 */

/** A team nobody has agreed money with yet. Spread into every new team. */
const NO_CONTRACT = {
  email: "",
  cost: null,
  deposit: null,
  depositPaidOn: "",
  balanceDueOn: "",
  balancePaidOn: "",
  confirmedOn: "",
} as const;

export function addPerson(crew: Crew, name: string, teamId: string | null): Crew {
  const clean = name.trim();
  if (!clean) return crew;
  const person: Person = { id: newId("p"), name: clean, teamId, phone: "", notes: "", guestId: null };
  return { ...crew, people: [...crew.people, person] };
}

export function addJob(crew: Crew, blockId: string, label = "New job"): Crew {
  const job: Job = {
    id: newId("j"),
    blockId,
    label,
    notes: "",
    teamId: null,
    personIds: [],
    status: "todo",
    dueOn: "",
  };
  return { ...crew, jobs: [...crew.jobs, job] };
}

/** A task off the day: something to have done by a date, rather than on it. */
export function addTask(crew: Crew, label: string, dueOn = ""): Crew {
  const clean = label.trim();
  if (!clean) return crew;
  const task: Job = { id: newId("j"), blockId: null, label: clean, notes: "", teamId: null, personIds: [], status: "todo", dueOn };
  return { ...crew, jobs: [...crew.jobs, task] };
}

export const patchJob = (crew: Crew, id: string, patch: Partial<Job>): Crew => ({
  ...crew,
  jobs: crew.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
});

export const removeJob = (crew: Crew, id: string): Crew => ({
  ...crew,
  jobs: crew.jobs.filter((j) => j.id !== id),
});

export function toggleAssignment(crew: Crew, jobId: string, personId: string): Crew {
  const job = crew.jobs.find((j) => j.id === jobId);
  if (!job) return crew;
  const personIds = job.personIds.includes(personId)
    ? job.personIds.filter((p) => p !== personId)
    : [...job.personIds, personId];
  return patchJob(crew, jobId, { personIds });
}

export const setJobStatus = (crew: Crew, jobId: string, status: JobStatus): Crew =>
  patchJob(crew, jobId, { status });

/**
 * Seed teams from the timeline's supplier tags.
 *
 * Matched on `tag`, so a team the user has since renamed is recognised as the
 * one it already is rather than added again. Only genuinely new tags produce a
 * team, and nothing existing is touched.
 */
export function seedTeamsFromTags(crew: Crew, timeline: Timeline): Crew {
  const known = new Set(crew.teams.map((t) => t.tag).filter((t): t is string => t !== null));
  const detail = new Map(timeline.tagDetails.map((d) => [d.tag, d]));

  const added: Team[] = [];
  for (const block of timeline.blocks) {
    for (const tag of block.tags) {
      if (known.has(tag)) continue;
      known.add(tag);
      const d = detail.get(tag);
      added.push({
        ...NO_CONTRACT,
        id: newId("team"),
        tag,
        name: d?.displayName || tag,
        phone: d?.phone ?? "",
        notes: d?.notes ?? "",
      });
    }
  }

  return added.length === 0 ? crew : { ...crew, teams: [...crew.teams, ...added] };
}

/** What to print against a job: the named people, or the team, or nobody. */
export function assigneeNames(crew: Crew, job: Job): string[] {
  const named = job.personIds
    .map((id) => crew.people.find((p) => p.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (named.length > 0) return named;
  const team = crew.teams.find((t) => t.id === job.teamId);
  return team ? [team.name] : [];
}

