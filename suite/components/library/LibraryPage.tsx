"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { migrate } from "@jfrusher/trousseau";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { publishDay, readTimeline } from "@/lib/model/slices";
import { applyTo, extract, KIND_NAMES, KINDS, type Kind } from "@/lib/library/items";
import type { LibraryListing } from "@/lib/library/store";
import { longDate } from "@/lib/dates";
import { Button, Empty } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/Confirm";
import { ToolUndo } from "@/components/shell/ToolUndo";

const CONTROL = "rounded border border-charcoal/15 bg-parchment px-2 py-1 text-sm text-charcoal focus:border-gold";

/** What each kind carries into another wedding, and what it leaves behind. */
const CARRIES: Record<Kind, string> = {
  cards: "The design, without the guests on it.",
  day: "The blocks, lanes and times, with each block’s notes — without the date, the couple or the suppliers’ numbers.",
  room: "The tables and the floor, with every chair empty.",
  checklist: "The tasks, each as so many days before the day.",
};

/** What putting it in does to the wedding it goes into, said before it is done. */
const REPLACES: Record<Exclude<Kind, "checklist">, string> = {
  cards: "The card design here is replaced. Who the cards are for is not.",
  day: "The running order here is replaced. Jobs tied to its blocks will need new ones.",
  room: "The room here is replaced, and everyone is unseated. Families and groups stay.",
};

type Listing = { status: "loading" } | { status: "ready"; items: LibraryListing[] } | { status: "signed-out" } | { status: "failed"; message: string };

/**
 * A planner's library: a card design, a running order, a room or a checklist
 * kept from one wedding to put into another. Kept on the account, so it is
 * there for every client; nothing personal goes in — see `lib/library/items`.
 */
export function LibraryPage() {
  const status = useTrousseauStore((s) => s.status);
  const raw = useTrousseauStore((s) => s.raw);
  const couple = useTrousseauStore((s) => s.doc.event.coupleNames);
  const past = useTrousseauStore((s) => s.past);
  const future = useTrousseauStore((s) => s.future);
  const confirm = useConfirm();
  const [listing, setListing] = useState<Listing>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/library");
    if (response.status === 401) return setListing({ status: "signed-out" });
    const body = (await response.json().catch(() => null)) as { items?: LibraryListing[]; error?: string } | null;
    setListing(response.ok && body?.items ? { status: "ready", items: body.items } : { status: "failed", message: body?.error ?? "The library could not be loaded." });
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const keep = async (kind: Kind, name: string) => {
    const content = extract(kind, useTrousseauStore.getState().raw);
    if (!content) return;
    const response = await fetch("/api/library", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, name, content }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setNotice(response.ok ? `Kept “${name}”.` : (body?.error ?? "It could not be kept."));
    if (response.ok) await load();
  };

  const use = async (item: LibraryListing) => {
    if (item.kind !== "checklist") {
      const ok = await confirm({ title: `Use “${item.name}” here?`, body: <p>{REPLACES[item.kind]} Undo takes it back.</p>, action: "Use it" });
      if (!ok) return;
    }
    const response = await fetch(`/api/library/${item.id}`);
    const body = (await response.json().catch(() => null)) as { content?: Record<string, unknown>; error?: string } | null;
    if (!response.ok || !body?.content) return setNotice(body?.error ?? "It could not be loaded.");
    const state = useTrousseauStore.getState();
    const entries = applyTo(item.kind, body.content, state.raw);
    // A new timeline is published again as the day, as every change to it is.
    if (entries.some(([slice]) => slice === "timeline")) {
      const next = migrate({ ...state.raw, ...Object.fromEntries(entries) });
      entries.push(["day", publishDay(next, readTimeline(next))]);
    }
    state.setSlices(entries, { label: `using “${item.name}”` });
    setNotice(`“${item.name}” is in this wedding now.`);
  };

  const remove = async (item: LibraryListing) => {
    const ok = await confirm({ title: `Remove “${item.name}”?`, body: <p>It goes from your library. Weddings it was used in keep it.</p>, action: "Remove", tone: "danger" });
    if (!ok) return;
    const response = await fetch(`/api/library/${item.id}`, { method: "DELETE" });
    if (response.ok) await load();
    else setNotice("It could not be removed.");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ToolUndo
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={() => useTrousseauStore.getState().undo()}
        onRedo={() => useTrousseauStore.getState().redo()}
        undoLabel={past[past.length - 1]?.label ?? null}
        redoLabel={future[future.length - 1]?.label ?? null}
      />
      <h1 className="font-display text-3xl text-charcoal">Library</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate">
        Designs you keep to use again, for any wedding you plan. Nobody goes in with them: a card design without its guests,
        a room with every chair empty, a running order and a checklist without their dates.
      </p>
      {notice ? (
        <p role="status" className="mt-4 text-sm text-charcoal">
          {notice}
        </p>
      ) : null}

      {listing.status === "signed-out" ? (
        <div className="mt-8">
          <Empty>
            The library is kept on your account.{" "}
            <Link href={`/login?next=${encodeURIComponent("/library")}`} className="underline">
              Sign in
            </Link>{" "}
            to use it.
          </Empty>
        </div>
      ) : (
        <>
          <section aria-labelledby="keep-title" className="mt-8">
            <h2 id="keep-title" className="mb-3 text-sm tracking-[0.14em] text-slate uppercase">
              Keep from {couple || "this wedding"}
            </h2>
            {status === "ready" ? (
              <ul className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-parchment">
                {KINDS.map((kind) => (
                  <KeepRow key={kind} kind={kind} available={extract(kind, raw) !== null} couple={couple} onKeep={keep} />
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-labelledby="kept-title" className="mt-10">
            <h2 id="kept-title" className="mb-3 text-sm tracking-[0.14em] text-slate uppercase">
              Kept
            </h2>
            {listing.status === "loading" ? (
              <p className="text-sm text-slate">Loading…</p>
            ) : listing.status === "failed" ? (
              <p className="text-sm text-danger">{listing.message}</p>
            ) : listing.items.length === 0 ? (
              <p className="text-sm text-slate">Nothing kept yet. Keep something from this wedding above.</p>
            ) : (
              <ul className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-parchment">
                {listing.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-charcoal">{item.name}</span>
                      <span className="block text-xs text-slate">
                        {KIND_NAMES[item.kind]} · kept {longDate(item.createdAt.slice(0, 10))}
                      </span>
                    </span>
                    <Button onClick={() => void use(item)}>Use in this wedding</Button>
                    <Button tone="danger" onClick={() => void remove(item)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function KeepRow({
  kind,
  available,
  couple,
  onKeep,
}: {
  kind: Kind;
  available: boolean;
  couple: string;
  onKeep: (kind: Kind, name: string) => Promise<void>;
}) {
  const [name, setName] = useState(`${couple || "This wedding"} — ${KIND_NAMES[kind].toLowerCase()}`);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-charcoal">{KIND_NAMES[kind]}</span>
        <span className="block text-xs text-slate">{available ? CARRIES[kind] : "Nothing here to keep yet."}</span>
      </span>
      {available ? (
        <>
          <input aria-label={`Name for this ${KIND_NAMES[kind].toLowerCase()}`} value={name} onChange={(event) => setName(event.target.value)} className={`${CONTROL} w-64`} />
          <Button onClick={() => void onKeep(kind, name.trim())} disabled={!name.trim()}>
            Keep
          </Button>
        </>
      ) : null}
    </li>
  );
}
