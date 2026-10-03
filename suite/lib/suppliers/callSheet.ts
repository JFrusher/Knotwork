import type { Knotwork } from "@jfrusher/knotwork";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { longDate } from "@/lib/dates";
import { readCrew, readTimeline, resolvedDay } from "@/lib/model/slices";

/**
 * One supplier's own call sheet: when to arrive, who of theirs is named, and
 * what they are doing, when and where. What a supplier's link shows.
 *
 * Only theirs. No guest is on it, and nothing of any other supplier's: the
 * wedding's names, date and venue, and the jobs that are this supplier's —
 * given to the team, or to someone in it.
 */
export interface CallSheet {
  wedding: { names: string; date: string; venue: string };
  supplier: string;
  /** "07:45", or "" where the running order does not say. */
  arrival: string;
  people: string[];
  /** On the day, soonest first. */
  jobs: Array<{ label: string; when: string; where: string; during: string }>;
  /** Before the day, with the date each is wanted by. */
  before: Array<{ label: string; by: string }>;
}

export function callSheet(doc: Knotwork, teamId: string): CallSheet | null {
  const crew = readCrew(doc);
  const team = crew.teams.find((entry) => entry.id === teamId);
  if (!team) return null;
  const timeline = readTimeline(doc);
  const blocks = new Map(timeline.blocks.map((block) => [block.id, block]));
  const times = new Map(resolvedDay(doc).map((block) => [block.id, block]));
  const theirs = new Set(crew.people.filter((person) => person.teamId === teamId).map((person) => person.id));
  const jobs = crew.jobs.filter((job) => job.teamId === teamId || job.personIds.some((id) => theirs.has(id)));
  const arrival = timeline.tagDetails.find((detail) => detail.tag === team.tag)?.arrivalMin;

  return {
    wedding: { names: doc.event.coupleNames, date: doc.event.date, venue: doc.event.venueName },
    supplier: team.name,
    arrival: typeof arrival === "number" ? formatClock(arrival) : "",
    people: crew.people.filter((person) => theirs.has(person.id)).map((person) => person.name),
    jobs: jobs
      .filter((job) => job.blockId !== null && times.has(job.blockId))
      .map((job) => ({ job, time: times.get(job.blockId!)!, block: blocks.get(job.blockId!) }))
      .sort((a, b) => a.time.startMin - b.time.startMin)
      .map(({ job, time, block }) => ({
        label: job.label,
        when: `${formatClock(time.startMin)}–${formatClock(time.contentEndMin)}`,
        where: block?.location ?? "",
        during: block?.label ?? "",
      })),
    before: jobs
      .filter((job) => job.blockId === null)
      .map((job) => ({ label: job.label, by: job.dueOn ? longDate(job.dueOn) : "" })),
  };
}
