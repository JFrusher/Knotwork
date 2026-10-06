import type { Knotwork } from "@jfrusher/knotwork";
import { daysUntil } from "@/lib/dates";
import { readiness, type Readiness } from "./readiness";
import { hiddenToolIds } from "./toolbox";

/** From how many days out the card shows. */
export const FORTNIGHT_DAYS = 14;

/** What is still open that would end up wrong on paper. */
const ON_PAPER = new Set([
  "unseated",
  "dietary-unprinted",
  "blocks-unplaced",
  "jobs-uncrewed",
  "shots-dangling",
  "ceremony-dangling",
  "ceremony-lost",
  "boxes-lost",
]);

interface PrintLink {
  label: string;
  href: string;
}

/**
 * The last fortnight: what to print, what to put on the phones, and what is
 * still open that a printout would carry. Null outside the last 14 days, so
 * the front page says it only when it is the thing to do.
 */
export function fortnight(
  doc: Knotwork,
  raw: unknown,
  today: string,
): { days: number; print: PrintLink[]; open: Readiness[] } | null {
  const date = doc.event.date;
  if (!date) return null;
  const days = daysUntil(date, today);
  if (days < 0 || days > FORTNIGHT_DAYS) return null;

  const hidden = hiddenToolIds(doc);
  const print: Array<PrintLink & { tool?: string }> = [
    { label: "The wedding pack: every PDF for the day in one", href: "/#wedding-pack" },
    { label: "Place cards", href: "/stationery?piece=place-cards", tool: "place-cards" },
    { label: "Table cards", href: "/stationery?piece=table-card", tool: "place-cards" },
    { label: "A job sheet for each person", href: "/delegation", tool: "delegation" },
    { label: "The shot list", href: "/group-shots", tool: "group-shots" },
  ];
  return {
    days,
    print: print.filter((link) => !link.tool || !hidden.has(link.tool)).map(({ label, href }) => ({ label, href })),
    open: readiness(doc, raw, today).filter((item) => ON_PAPER.has(item.id)),
  };
}
