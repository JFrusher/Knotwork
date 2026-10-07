import type { WeddingListing } from "@/lib/accounts/handlers";
import { daysUntil, longDate, todayIso } from "@/lib/dates";

/** Soonest wedding first — the order a planner works through them — and undated last. */
const soonestFirst = (weddings: WeddingListing[]) =>
  [...weddings].sort(
    (a, b) => (a.date === "" ? 1 : 0) - (b.date === "" ? 1 : 0) || a.date.localeCompare(b.date),
  );

function daysToGo(iso: string): string {
  if (!iso) return "";
  const days = daysUntil(iso, todayIso());
  if (days < 0) return "Been and gone";
  if (days === 0) return "Today";
  return days === 1 ? "Tomorrow" : `${days} days to go`;
}

/**
 * A planner's clients, soonest first, each with how it stands: the next thing
 * to do, what is still to pay, and when it was last saved.
 */
export function WeddingList({ weddings, open }: { weddings: WeddingListing[]; open: string | null }) {
  return (
    <ul className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10">
      {soonestFirst(weddings).map((wedding) => (
        <li key={wedding.weddingId} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-charcoal">{wedding.names || "A wedding with no names yet"}</p>
            <p className="text-sm text-slate">
              {[
                longDate(wedding.date),
                daysToGo(wedding.date),
                wedding.role !== "partner" ? "Client" : "Yours",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className={`mt-1 text-sm ${wedding.state.blocking > 0 ? "text-danger" : "text-charcoal"}`}>
              {wedding.state.next === null
                ? "Nothing left that spans the tools."
                : `Next: ${wedding.state.next}${wedding.state.left > 1 ? ` (and ${wedding.state.left - 1} more)` : ""}`}
            </p>
            <p className="text-xs text-slate">
              {[
                wedding.state.owed > 0 ? `${wedding.state.owed.toLocaleString()} still to pay` : "",
                wedding.savedAt
                  ? `Last saved ${new Date(wedding.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : "Nothing saved yet",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {wedding.weddingId === open ? (
            <span className="text-sm text-slate">Open here</span>
          ) : (
            // A full load, never a client-side one — see `/open`.
            <a
              href={`/open/${wedding.weddingId}`}
              className="rounded border border-charcoal/15 px-3 py-1.5 text-sm text-charcoal transition hover:border-gold"
            >
              Open
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
