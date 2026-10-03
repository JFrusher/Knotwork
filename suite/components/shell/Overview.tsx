"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { readiness, type Readiness } from "@/lib/model/readiness";
import { overview, type Area, type AreaId } from "@/lib/model/overview";
import { GUESTS, TOOLS, type Tab } from "@/lib/tools";
import { SignInFailed } from "./SignInFailed";
import { TakeTheTour } from "./TourButtons";

/** Where each area is worked on, and how it is drawn. */
const PLACES = { guests: GUESTS, ...Object.fromEntries(TOOLS.map((tool) => [tool.id, tool])) } as Record<AreaId, Tab>;

/**
 * The wedding's state: the one thing to do next, how far along each part is,
 * and what else is left.
 *
 * It replaced a grid of the five tools, which repeated the header, and four
 * bare counts. The next step is the one loud thing on the page — a blocking
 * problem before an advisory one, and otherwise What is left's own order —
 * and the rest of the list is quiet below, so nothing is lost by leading with
 * one.
 */
export function Overview() {
  const doc = useKnotworkStore((s) => s.doc);
  const raw = useKnotworkStore((s) => s.raw);
  const status = useKnotworkStore((s) => s.status);
  const savedAt = useKnotworkStore((s) => s.savedAt);

  // Blocking first; `sort` is stable, so each keeps What is left's order.
  const items = useMemo(
    () => [...readiness(doc, raw)].sort((a, b) => rank(a) - rank(b)),
    [doc, raw],
  );
  const areas = useMemo(() => overview(doc, raw), [doc, raw]);

  if (status !== "ready") return <div className="mt-10 h-40 animate-pulse rounded-lg bg-stone" />;

  const [next, ...rest] = items;

  return (
    <>
      <SignInFailed />

      <section aria-label="Next" className="mt-10">
        {next ? <NextStep item={next} /> : <NothingLeft />}
      </section>

      <section aria-labelledby="areas-heading" className="mt-12">
        <h2 id="areas-heading" className="mb-4 text-sm tracking-[0.14em] text-slate uppercase">
          Where things stand
        </h2>
        <ul data-tour="shell.areas" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </ul>
        <p className="mt-5 text-xs text-slate">
          {savedAt
            ? `Saved to this browser at ${new Date(savedAt).toLocaleTimeString()}.`
            : "Saved to this browser as you work."}{" "}
          Export a backup from the Data button — it is the only copy that survives clearing the
          browser.
        </p>
        <TakeTheTour />
      </section>

      {rest.length > 0 ? (
        <section aria-labelledby="left-heading" className="mt-12">
          <h2 id="left-heading" className="mb-4 text-sm tracking-[0.14em] text-slate uppercase">
            Also left
          </h2>
          <ul className="flex flex-col gap-2">
            {rest.map((item) => (
              <li key={item.id}>
                <LeftRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const rank = (item: Readiness) => (item.severity === "blocking" ? 0 : 1);

function NextStep({ item }: { item: Readiness }) {
  const blocking = item.severity === "blocking";
  return (
    <Link
      href={item.href}
      data-tour="shell.next"
      className={`group flex items-center gap-4 rounded-lg border-2 bg-parchment px-5 py-4 transition ${
        blocking ? "border-danger/60 hover:border-danger" : "border-gold/60 hover:border-gold"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs tracking-[0.14em] text-slate uppercase">Next</span>
        <span className="mt-1 block text-lg text-charcoal">{item.message}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded border border-charcoal/15 px-3 py-1.5 text-sm text-charcoal group-hover:border-charcoal/40">
        {item.action}
        <ArrowRight size={14} aria-hidden />
      </span>
    </Link>
  );
}

function NothingLeft() {
  return (
    <p
      data-tour="shell.next"
      className="flex items-center gap-2 rounded border border-ok/40 bg-ok-soft px-4 py-3 text-sm text-charcoal"
    >
      <Check size={16} className="shrink-0 text-ok" aria-hidden />
      Nothing left that spans the tools. Each one will tell you about its own work.
    </p>
  );
}

function LeftRow({ item }: { item: Readiness }) {
  const blocking = item.severity === "blocking";
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded border px-4 py-3 transition ${
        blocking
          ? "border-danger/40 bg-danger-soft hover:border-danger"
          : "border-charcoal/10 bg-stone/50 hover:border-charcoal/25"
      }`}
    >
      <AlertTriangle size={16} aria-hidden className={`shrink-0 ${blocking ? "text-danger" : "text-slate"}`} />
      <span className="min-w-0 flex-1 text-sm text-charcoal">{item.message}</span>
      <span className="hidden shrink-0 items-center gap-1 text-xs text-slate group-hover:text-charcoal sm:flex">
        {item.action}
        <ArrowRight size={13} aria-hidden />
      </span>
    </Link>
  );
}

function AreaCard({ area }: { area: Area }) {
  const place = PLACES[area.id];
  return (
    <li>
      <Link
        href={place.href}
        className={`${place.tokens} block h-full rounded-lg border border-charcoal/10 bg-parchment p-4 transition hover:border-gold`}
      >
        <span className="flex items-center gap-2 text-sm text-slate">
          <place.icon size={16} aria-hidden className="text-[var(--accent-bright)]" />
          {place.name}
        </span>
        {/* Lato, not Marcellus: the display face draws 1 and 0 like I and O. */}
        <span className="mt-2 block text-2xl text-charcoal tabular-nums">{area.summary}</span>
        {area.detail ? <span className="mt-1 block text-xs text-slate">{area.detail}</span> : null}
        {area.progress !== null ? (
          // The figures above say it in words; the bar is for the eye.
          <span aria-hidden className="mt-3 block h-1 overflow-hidden rounded bg-charcoal/10">
            <span
              className="block h-full rounded bg-[var(--accent-bright)]"
              style={{ width: `${Math.round(area.progress * 100)}%` }}
            />
          </span>
        ) : null}
      </Link>
    </li>
  );
}
