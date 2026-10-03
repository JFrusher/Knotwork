"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import type { WeddingListing } from "@/lib/accounts/handlers";
import { Button } from "@/components/ui/controls";
import { todayIso } from "@/lib/dates";
import { WeddingList } from "@/components/weddings/WeddingList";


/**
 * Every wedding the account is on — for a planner, one per client.
 *
 * Also the planners' door: signing in with this as the destination starts no
 * wedding of their own (see `/auth/callback`'s `startsAWedding`).
 */
export default function WeddingsPage() {
  const client = browserClient();
  const open = useKnotworkStore((s) => s.weddingId);
  const [weddings, setWeddings] = useState<WeddingListing[] | "signed-out" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setWeddings("signed-out");
        return;
      }
      // Our own date, for what has fallen due.
      const response = await fetch(`/api/accounts/weddings?today=${todayIso()}`);
      const body = (await response.json().catch(() => null)) as { weddings?: WeddingListing[]; error?: string } | null;
      if (response.ok && body?.weddings) setWeddings(body.weddings);
      else setProblem(body?.error ?? "Your weddings could not be loaded.");
    });
  }, [client]);

  async function startClientWedding() {
    const response = await fetch("/api/accounts/weddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "planner" }),
    });
    const body = (await response.json().catch(() => null)) as { weddingId?: string; error?: string } | null;
    if (!response.ok || !body?.weddingId) {
      setProblem(body?.error ?? "The wedding could not be started.");
      return;
    }
    window.location.assign(`/open/${body.weddingId}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Knotwork</p>
      <h1 className="mt-3 font-display text-3xl text-charcoal">Your weddings</h1>

      {!client ? (
        <p className="mt-6 text-slate">Accounts are not set up on this deployment.</p>
      ) : weddings === "signed-out" ? (
        <div className="mt-6 space-y-4">
          <p className="text-slate">Planning weddings for clients? Sign in to see them all in one place.</p>
          <Link
            href={`/login?next=${encodeURIComponent("/weddings")}`}
            className="inline-flex min-h-11 items-center rounded border border-gold bg-gold/15 px-4 py-2 text-sm text-charcoal transition hover:bg-gold/25"
          >
            Sign in
          </Link>
        </div>
      ) : weddings === null ? (
        <p className="mt-6 text-slate">{problem ?? "Loading…"}</p>
      ) : (
        <div className="mt-6 space-y-6">
          {problem ? (
            <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
              {problem}
            </p>
          ) : null}
          {weddings.length === 0 ? (
            <p className="text-slate">None yet. Start one for a client, and invite the couple to it.</p>
          ) : (
            <WeddingList weddings={weddings} open={open} />
          )}
          <div className="flex flex-wrap items-center gap-4">
            <Button tone="primary" icon={Plus} onClick={() => void startClientWedding()}>
              Start a client’s wedding
            </Button>
            <Link href="/library" className="text-sm text-charcoal underline">
              Your library of designs to use again
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
