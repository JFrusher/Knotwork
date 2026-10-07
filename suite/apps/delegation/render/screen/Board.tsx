import Link from "next/link";
import { useMemo } from "react";
import { assigneeNames, type Job } from "../../core/model/types";
import { formatClock } from "@/lib/minutes";
import { useDelegationDoc, useCover, useStore } from "../../state/store";
import styles from "./Board.module.css";

/**
 * The day as a column of blocks in clock order, each holding its jobs.
 *
 * Not a Gantt: Timeline already draws the day to scale, and what this view is
 * for is working down a list and putting names against it. Blocks with no jobs
 * stay visible, because an empty block is where the next job goes.
 */
export function Board() {
  const doc = useDelegationDoc();
  const cover = useCover();
  const selectedJobId = useStore((state) => state.selectedJobId);
  const filter = useStore((state) => state.filter);
  const select = useStore((state) => state.select);
  const addJob = useStore((state) => state.addJob);

  const blocks = useMemo(
    () => [...(doc.day?.blocks ?? [])].sort((a, b) => a.startMin - b.startMin || a.lane.localeCompare(b.lane)),
    [doc.day],
  );

  const shown = (job: Job): boolean => {
    if (filter.personId !== null && !job.personIds.includes(filter.personId)) return false;
    if (filter.teamId !== null) {
      const members = doc.people
        .filter((person) => person.teamId === filter.teamId)
        .map((person) => person.id);
      const held = job.teamId === filter.teamId || job.personIds.some((id) => members.includes(id));
      if (!held) return false;
    }
    // Jobs on the day with nobody on them: a task before it is the couple's own.
    if (filter.unassignedOnly && (job.personIds.length > 0 || job.blockId === null)) return false;
    return true;
  };

  const filtering =
    filter.personId !== null || filter.teamId !== null || filter.unassignedOnly;

  // These look identical to a filter and mean opposite things. A job with no
  // block was never on the day; a job whose block has gone is a problem.
  const tasks = doc.jobs.filter((job) => job.blockId === null && shown(job));
  const orphans = doc.jobs.filter(
    (job) =>
      job.blockId !== null && !blocks.some((block) => block.id === job.blockId) && shown(job),
  );

  if (doc.day === null) {
    return (
      <div className={styles.empty}>
        <h2>No day yet</h2>
        <p>
          Each job hangs off a part of the day, and the day is the Timeline&rsquo;s. Add it there first, and it
          shows here.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.board}>
      {/* Folded: the tasks before the day are the Checklist's, and here only
          to hand one to somebody. Open while filtering, or with one picked. */}
      {tasks.length > 0 && (
        <details className={styles.tasks} open={filtering || tasks.some((job) => job.id === selectedJobId)}>
          <summary className={styles.tasksHead}>
            Before the day — {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </summary>
          <p className={styles.tasksNote}>
            Kept on the <Link href="/checklist" className="underline">
              Checklist
            </Link>. Pick one to give it to somebody.
          </p>
          <ul className={styles.jobs}>
            {tasks.map((job) => (
              <JobRow key={job.id} job={job} selected={job.id === selectedJobId} onSelect={select} />
            ))}
          </ul>
        </details>
      )}

      {orphans.length > 0 && (
        <section className={styles.orphans}>
          <h2 className={styles.orphanHead}>
            Work that has lost its place — {orphans.length} job
            {orphans.length === 1 ? "" : "s"}
          </h2>
          <ul className={styles.jobs}>
            {orphans.map((job) => (
              <JobRow key={job.id} job={job} selected={job.id === selectedJobId} onSelect={select} />
            ))}
          </ul>
        </section>
      )}

      {blocks.map((block) => {
        const jobs = doc.jobs.filter((job) => job.blockId === block.id && shown(job));
        const hidden = doc.jobs.filter((job) => job.blockId === block.id).length - jobs.length;

        // With no filter on, an empty block stays: it is where the next job
        // goes. While filtering, it is only noise between the answers.
        if (filtering && jobs.length === 0) return null;

        return (
          <section key={block.id} className={styles.block}>
            <header className={styles.head}>
              <span className={styles.time}>{formatClock(block.startMin)}</span>
              <span className={styles.label}>
                {block.label}
                {block.moment && <span className={styles.moment} title="A moment" />}
              </span>
              <span className={styles.meta}>
                {[block.lane, block.location].filter(Boolean).join(" · ")}
                {block.moment ? "" : ` · to ${formatClock(block.endMin)}`}
              </span>
              <button
                type="button"
                className={styles.add}
                title={`Add a job during ${block.label}`}
                onClick={() => addJob(block.id)}
              >
                + Job
              </button>
            </header>

            {jobs.length === 0 ? (
              <p className={styles.none}>
                {hidden > 0 ? `${hidden} job${hidden === 1 ? "" : "s"} hidden by the filter` : "No jobs"}
              </p>
            ) : (
              <ul className={styles.jobs}>
                {jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    selected={job.id === selectedJobId}
                    onSelect={select}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );

  function JobRow({
    job,
    selected,
    onSelect,
  }: {
    job: Job;
    selected: boolean;
    onSelect: (id: string) => void;
  }) {
    const who = assigneeNames(doc, job);
    const trouble = cover.byJob.get(job.id) ?? [];
    const severity = trouble.some((warning) => warning.severity === "conflict")
      ? styles.conflict
      : trouble.length > 0
        ? styles.advisory
        : "";

    return (
      <li className={[styles.job, selected ? styles.selected : "", severity].filter(Boolean).join(" ")}>
        <button type="button" className={styles.pick} onClick={() => onSelect(job.id)}>
          <span className={styles.jobLabel}>{job.label}</span>
          {/* A task with nobody named is the couple's own, not a gap. */}
          {who.length > 0 || job.blockId !== null ? (
            <span className={who.length > 0 ? styles.who : styles.nobody}>
              {who.length > 0 ? who.join(", ") : "nobody yet"}
            </span>
          ) : null}
          {trouble[0] && <span className={styles.warning}>{trouble[0].message}</span>}
        </button>
      </li>
    );
  }
}

