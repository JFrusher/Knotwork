"use client";

import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { useWeddings } from "@/lib/store/weddings";
import type { WeddingListing } from "@/lib/accounts/handlers";

export function weddingLabel(wedding: WeddingListing): string {
  return `${wedding.names || "A wedding with no names yet"}${wedding.role === "planner" ? " · client" : ""}`;
}

/**
 * Which of the account's weddings is open on this device, and the way to
 * another. Only for an account on more than one — in practice, a planner.
 *
 * Opening one is a full load of `/open/<id>`, never a change in place: see
 * that page for why.
 */
export function WeddingSwitcher() {
  const weddings = useWeddings((s) => s.weddings);
  const current = useTrousseauStore((s) => s.weddingId);
  if (!weddings || weddings.length < 2) return null;

  return (
    <label className="shrink-0">
      <span className="sr-only">Wedding</span>
      <select
        value={current ?? ""}
        onChange={(event) => window.location.assign(`/open/${event.target.value}`)}
        className="max-w-44 truncate rounded border border-charcoal/15 bg-parchment px-2 py-1.5 text-sm text-charcoal"
      >
        {current === null ? (
          <option value="" disabled>
            Choose a wedding
          </option>
        ) : null}
        {weddings.map((wedding) => (
          <option key={wedding.weddingId} value={wedding.weddingId}>
            {weddingLabel(wedding)}
          </option>
        ))}
      </select>
    </label>
  );
}
