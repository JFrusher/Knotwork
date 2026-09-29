import { addTask } from "@/lib/model/crewActions";
import type { Crew, Job } from "@/lib/model/types";
import { daysUntil } from "@/lib/dates";

/**
 * The things to have done before the day, as against the jobs on it: the
 * crew's jobs with no block, which the 2026-09-08 design made general tasks.
 * A task has a date to be done by, and is done or not.
 */

export const isTask = (job: Job) => job.blockId === null;

/** How far ahead a task counts as coming up. */
export const COMING_UP_DAYS = 30;

export interface Checklist {
  overdue: Job[];
  comingUp: Job[];
  later: Job[];
  undated: Job[];
  done: Job[];
}

export function checklist(crew: Crew, today: string): Checklist {
  const tasks = crew.jobs.filter(isTask);
  const open = tasks.filter((task) => task.status !== "done");
  const dated = open.filter((task) => task.dueOn !== "").sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return {
    overdue: dated.filter((task) => daysUntil(task.dueOn, today) < 0),
    comingUp: dated.filter((task) => {
      const days = daysUntil(task.dueOn, today);
      return days >= 0 && days <= COMING_UP_DAYS;
    }),
    later: dated.filter((task) => daysUntil(task.dueOn, today) > COMING_UP_DAYS),
    undated: open.filter((task) => task.dueOn === ""),
    done: tasks.filter((task) => task.status === "done"),
  };
}

/**
 * The tasks most weddings have, each so many days before the day.
 *
 * Dates rather than a fixed calendar, because a wedding eight months away and
 * one two years away are the same list at different points along it.
 */
export const USUAL_TASKS: ReadonlyArray<{ label: string; daysBefore: number }> = [
  { label: "Set the budget", daysBefore: 365 },
  { label: "Book the venue", daysBefore: 365 },
  { label: "Book the registrar or celebrant", daysBefore: 330 },
  { label: "Book the photographer", daysBefore: 300 },
  { label: "Book the caterer", daysBefore: 300 },
  { label: "Send save-the-dates", daysBefore: 240 },
  { label: "Book the band or DJ", daysBefore: 210 },
  { label: "Book the florist", daysBefore: 180 },
  { label: "Order the outfits", daysBefore: 180 },
  { label: "Book the cars", daysBefore: 150 },
  { label: "Send the invitations", daysBefore: 120 },
  { label: "Order the cake", daysBefore: 120 },
  { label: "Buy the rings", daysBefore: 90 },
  // At least 29 days before, and at most a year, in England and Wales.
  { label: "Give notice of marriage", daysBefore: 90 },
  { label: "Chase the replies still to come", daysBefore: 45 },
  { label: "Final numbers to the caterer", daysBefore: 14 },
  { label: "Finish the seating plan", daysBefore: 14 },
  { label: "Print the place cards", daysBefore: 7 },
  { label: "Confirm times with every supplier", daysBefore: 7 },
];

/** An ISO date so many days before another. */
function daysBefore(iso: string, days: number): string {
  const when = new Date(`${iso}T12:00:00Z`);
  when.setUTCDate(when.getUTCDate() - days);
  return when.toISOString().slice(0, 10);
}

/**
 * The usual tasks this wedding does not have yet — matched by name, so it can
 * be asked for twice without doubling up — dated from the wedding's day, or
 * undated while there is no day.
 */
export function withUsualTasks(crew: Crew, weddingDate: string): Crew {
  const have = new Set(crew.jobs.filter(isTask).map((task) => task.label.trim().toLowerCase()));
  return USUAL_TASKS.filter((task) => !have.has(task.label.toLowerCase())).reduce(
    (next, task) => addTask(next, task.label, weddingDate ? daysBefore(weddingDate, task.daysBefore) : ""),
    crew,
  );
}
