import type { Trousseau } from "@jfrusher/trousseau";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { guestName, readCrew, readGuests, readSeating, readTimeline, resolvedDay } from "@/lib/model/slices";
import { longDate } from "@/lib/money/money";
import { TOOLS, WEDDING_PAGES } from "@/lib/tools";

/**
 * Everything in the wedding that can be gone to by name — a page, a guest, a
 * table, a block of the day, a job, a task — and where each opens: a tool on
 * that record, the Guests page found to that guest, the Checklist.
 */

export type EntryKind = "Page" | "Guest" | "Table" | "Block" | "Job" | "Task";

export interface Entry {
  kind: EntryKind;
  name: string;
  /** A second line: a guest's table, a block's time, who does a job. */
  detail: string;
  href: string;
}

const KIND_ORDER: EntryKind[] = ["Page", "Guest", "Table", "Block", "Job", "Task"];

export function entries(doc: Trousseau): Entry[] {
  const guests = readGuests(doc);
  const tables = readSeating(doc).tables;
  const crew = readCrew(doc);
  const starts = new Map(resolvedDay(doc).map((block) => [block.id, block.startMin]));
  const people = new Map(crew.people.map((person) => [person.id, person.name]));

  return [
    ...[...WEDDING_PAGES, ...TOOLS].map((page) => ({ kind: "Page" as const, name: page.name, detail: "", href: page.href })),
    ...Object.values(guests).map((guest) => {
      const name = guestName(guest);
      const table = guest.assignedTableId ? tables[guest.assignedTableId]?.label : "";
      return { kind: "Guest" as const, name, detail: table || "No table yet", href: `/guests?q=${encodeURIComponent(name)}` };
    }),
    ...Object.values(tables).map((table) => ({
      kind: "Table" as const,
      name: table.label,
      detail: `${table.assignedGuestIds.filter(Boolean).length} of ${table.capacity} seats taken`,
      href: `/seating?select=${encodeURIComponent(table.id)}`,
    })),
    ...readTimeline(doc).blocks.map((block) => {
      const start = starts.get(block.id);
      return {
        kind: "Block" as const,
        name: block.label,
        detail: [start === undefined ? "" : formatClock(start), block.location].filter(Boolean).join(" · "),
        href: `/timeline?select=${encodeURIComponent(block.id)}`,
      };
    }),
    ...crew.jobs.map((job) => {
      const who = job.personIds.map((id) => people.get(id)).filter(Boolean).join(", ");
      return job.blockId === null
        ? { kind: "Task" as const, name: job.label, detail: job.dueOn ? `By ${longDate(job.dueOn)}` : "", href: "/checklist" }
        : { kind: "Job" as const, name: job.label, detail: who || "Nobody yet", href: `/delegation?select=${encodeURIComponent(job.id)}` };
    }),
  ].filter((entry) => entry.name.trim() !== "");
}

/**
 * The entries a query finds, best first: a name that starts with it, then one
 * with a word that does, then one that has it anywhere. With no query, the
 * pages — somewhere to go, before anything has been typed.
 */
export function search(all: readonly Entry[], query: string, limit = 12): Entry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return all.filter((entry) => entry.kind === "Page");
  const rank = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) return 0;
    if (lower.split(/[\s\-–—&,.']+/).some((word) => word.startsWith(q))) return 1;
    return lower.includes(q) ? 2 : null;
  };
  return all
    .map((entry) => ({ entry, rank: rank(entry.name) }))
    .filter((found): found is { entry: Entry; rank: number } => found.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        KIND_ORDER.indexOf(a.entry.kind) - KIND_ORDER.indexOf(b.entry.kind) ||
        a.entry.name.localeCompare(b.entry.name, "en", { numeric: true }),
    )
    .slice(0, limit)
    .map((found) => found.entry);
}
