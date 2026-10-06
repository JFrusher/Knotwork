"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListPlus, Trash2 } from "lucide-react";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { readCrew } from "@/lib/model/slices";
import { addTask, assigneeNames, patchJob, removeJob, setJobStatus } from "@/lib/model/crewActions";
import type { Crew, Job } from "@/lib/model/types";
import { checklist, isTask, USUAL_TASKS, withUsualTasks } from "@/lib/checklist/checklist";
import { barErrands, withErrandDone, type Errand } from "@/lib/checklist/barErrands";
import { longDate, todayIso } from "@/lib/dates";
import { Button, Empty } from "@/components/ui/controls";
import { ToolUndo } from "@/components/shell/ToolUndo";
import { EYEBROW } from "@/components/ui/eyebrow";

const CONTROL = "rounded border border-charcoal/15 bg-parchment px-2 py-1 text-sm text-charcoal focus:border-gold";

/** Every change starts from the wedding as it is now, not as it was at the last render. */
function write(change: (crew: Crew) => Crew, label: string) {
  const { doc, setSlice } = useKnotworkStore.getState();
  setSlice("crew", change(readCrew(doc)), { label });
}

/**
 * What to have done before the day: the crew's jobs with no block, each with
 * a date to be done by. The jobs on the day are Delegation's, and so is who
 * does what — a task can be given to somebody there; with nobody named it is
 * the couple's own.
 */
export function ChecklistPage() {
  const status = useKnotworkStore((s) => s.status);
  const doc = useKnotworkStore((s) => s.doc);
  const today = todayIso();

  const crew = readCrew(doc);
  const list = useMemo(() => checklist(crew, today), [crew, today]);
  const errands = useMemo(() => barErrands(doc), [doc]);
  const missing = useMemo(() => {
    const have = new Set(crew.jobs.filter(isTask).map((task) => task.label.trim().toLowerCase()));
    return USUAL_TASKS.filter((task) => !have.has(task.label.toLowerCase())).length;
  }, [crew]);

  if (status !== "ready") return <div className="mx-auto mt-10 h-40 max-w-4xl animate-pulse rounded-lg bg-stone" />;

  const date = doc.event.date;
  const total = list.overdue.length + list.comingUp.length + list.later.length + list.undated.length + list.done.length;
  const sections: Array<{ title: string; tasks: Job[]; late?: boolean }> = [
    { title: "Late", tasks: list.overdue, late: true },
    { title: "In the next 30 days", tasks: list.comingUp },
    { title: "Later", tasks: list.later },
    { title: "No date", tasks: list.undated },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ToolUndo />

      <h1 className="font-display text-3xl text-charcoal">Checklist</h1>
      <p className="mt-1 text-sm text-slate">
        What to have done before the day. The jobs on the day itself, and who does them, are in{" "}
        <Link href="/delegation" className="underline">
          Delegation
        </Link>
        .
      </p>

      <NewTask />

      {missing > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate">
          <Button icon={ListPlus} onClick={() => write((current) => withUsualTasks(current, date), "the usual tasks")}>
            Add the usual tasks
          </Button>
          <span>
            {missing} things most weddings have to do,{" "}
            {date ? `dated back from ${longDate(date)}` : "undated until the wedding has a date"}.
          </span>
        </div>
      ) : null}

      {total === 0 ? (
        <div className="mt-10">
          <Empty>No tasks yet. Add one above, or start from the usual ones.</Empty>
        </div>
      ) : (
        <div data-tour="checklist.list" className="mt-8 space-y-8">
          {sections
            .filter((section) => section.tasks.length > 0)
            .map((section) => (
              <section key={section.title} aria-labelledby={`tasks-${section.title}`}>
                <h2
                  id={`tasks-${section.title}`}
                  className={`mb-2 ${section.late ? "text-danger" : "text-slate"} ${EYEBROW}`}
                >
                  {section.title}
                </h2>
                <ul className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-parchment">
                  {section.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} who={assigneeNames(crew, task)} />
                  ))}
                </ul>
              </section>
            ))}
          {list.done.length > 0 ? (
            <details>
              <summary className={`cursor-pointer text-slate ${EYEBROW}`}>
                Done ({list.done.length})
              </summary>
              <ul className="mt-2 divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-parchment">
                {list.done.map((task) => (
                  <TaskRow key={task.id} task={task} who={assigneeNames(crew, task)} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      {errands.length > 0 ? (
        <section aria-labelledby="tasks-bar" className="mt-8">
          <h2 id="tasks-bar" className={`mb-2 text-slate ${EYEBROW}`}>
            From the Bar
          </h2>
          <ul className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-parchment">
            {errands.map((errand) => (
              <ErrandRow key={errand.id} errand={errand} />
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate">
            Worked out from the{" "}
            <Link href="/bar" className="underline">
              Bar
            </Link>
            &rsquo;s shopping list, so they change when it does.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** One of the Bar's errands: ticked here, worked out there. */
function ErrandRow({ errand }: { errand: Errand }) {
  const toggle = () => {
    const { doc } = useKnotworkStore.getState();
    write((crew) => withErrandDone(crew, errand.id, !errand.done, barErrands(doc)), errand.done ? "an errand undone" : "an errand done");
  };
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2">
      <input type="checkbox" aria-label={`${errand.label}: done`} checked={errand.done} onChange={toggle} />
      <span className={`min-w-0 flex-1 text-sm ${errand.done ? "text-slate line-through" : "text-charcoal"}`}>{errand.label}</span>
      <span className="text-sm text-slate">{errand.dueOn ? `By ${longDate(errand.dueOn)}` : "No date yet"}</span>
    </li>
  );
}

function NewTask() {
  const [label, setLabel] = useState("");
  const [dueOn, setDueOn] = useState("");
  const add = () => {
    if (!label.trim()) return;
    write((crew) => addTask(crew, label, dueOn), "a task");
    setLabel("");
    setDueOn("");
  };
  return (
    <form
      aria-label="Add a task"
      className="mt-6 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-slate">
        Task
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Book the cake tasting" className={`${CONTROL} w-72`} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate">
        Done by
        <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className={CONTROL} />
      </label>
      <button
        type="submit"
        disabled={!label.trim()}
        className="rounded border border-gold bg-gold/15 px-3 py-1.5 text-sm text-charcoal hover:bg-gold/25 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}

function TaskRow({ task, who }: { task: Job; who: string[] }) {
  const done = task.status === "done";
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2">
      <input
        type="checkbox"
        aria-label={`${task.label}: done`}
        checked={done}
        onChange={() => write((crew) => setJobStatus(crew, task.id, done ? "todo" : "done"), done ? "a task undone" : "a task done")}
      />
      <input
        // Keyed on the stored label, so an undo shows through.
        key={task.label}
        aria-label="Task"
        defaultValue={task.label}
        onBlur={(event) => {
          const label = event.target.value.trim();
          if (label && label !== task.label) write((crew) => patchJob(crew, task.id, { label }), "a task");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={`min-w-0 flex-1 border-0 bg-transparent px-0 text-sm focus:ring-0 ${done ? "text-slate line-through" : "text-charcoal"}`}
      />
      {who.length > 0 ? <span className="text-xs text-slate">{who.join(", ")}</span> : null}
      <input
        type="date"
        aria-label={`${task.label}: done by`}
        value={task.dueOn}
        onChange={(event) => write((crew) => patchJob(crew, task.id, { dueOn: event.target.value }), "a task's date")}
        className={CONTROL}
      />
      <button
        type="button"
        aria-label={`Remove “${task.label}”`}
        title="Remove. Undo brings it back."
        onClick={() => write((crew) => removeJob(crew, task.id), "removing a task")}
        className="rounded p-1.5 text-slate transition hover:bg-stone hover:text-danger"
      >
        <Trash2 size={15} aria-hidden />
      </button>
    </li>
  );
}
