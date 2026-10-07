"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Check } from "lucide-react";
import { calendarFile, slug } from "@/apps/timeline/render/ics/calendar";
import { Button } from "@/components/ui/controls";
import { download } from "@/lib/data/file";
import { localDay, longDate } from "@/lib/dates";
import { importShareKey, unseal } from "@/lib/share/crypto";
import type { CallSheet } from "@/lib/suppliers/callSheet";
import type { SealedSheet } from "@/lib/suppliers/store";

const dayOf = (at: string) => longDate(localDay(new Date(at)));

/**
 * The page a supplier's link opens: their own call sheet, and a button that
 * tells whoever sent it that they have it.
 *
 * As the guests' page: the key is in the URL fragment, which the browser never
 * sends to a server, so the host holding the sheet cannot read it.
 */
export function SupplierSheet({ token }: { token: string }) {
  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [publishedAt, setPublishedAt] = useState("");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notConfirmed, setNotConfirmed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    void (async () => {
      // Read before anything else touches the URL. `location.hash` is the only
      // place this key ever exists.
      const key = new URLSearchParams(window.location.hash.slice(1)).get("k");
      if (!key) {
        setProblem("This link is missing the part after the # that unlocks it. Copy the whole link.");
        return;
      }
      try {
        const response = await fetch(`/api/suppliers/${token}`);
        if (!response.ok) {
          setProblem("This link is not live. Ask whoever sent it for a new one.");
          return;
        }
        const sealed = (await response.json()) as SealedSheet;
        const opened = (await unseal(await importShareKey(key), sealed)) as CallSheet;
        if (!live) return;
        setSheet(opened);
        setPublishedAt(sealed.publishedAt);
        setConfirmedAt(sealed.confirmedAt);
      } catch {
        if (live) setProblem("This link could not be opened. Copy the whole link and try again.");
      }
    })();

    return () => {
      live = false;
    };
  }, [token]);

  const confirm = async () => {
    setConfirming(true);
    try {
      const response = await fetch(`/api/suppliers/${token}`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { confirmedAt?: string; error?: string } | null;
      if (!response.ok || !body?.confirmedAt) {
        setNotConfirmed(body?.error ?? "That did not go through. Try again in a moment.");
        return;
      }
      setNotConfirmed(null);
      setConfirmedAt(body.confirmedAt);
    } finally {
      setConfirming(false);
    }
  };

  if (problem) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="mb-3 text-2xl">Not this link</h1>
        <p className="text-slate">{problem}</p>
      </main>
    );
  }

  if (!sheet) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-slate">Opening…</p>
      </main>
    );
  }

  const confirmedOn = confirmedAt === null ? null : dayOf(confirmedAt);
  const confirmedCurrent = confirmedAt !== null && Date.parse(confirmedAt) >= Date.parse(publishedAt);

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-sm text-slate">For {sheet.supplier}</p>
        <h1 className="font-display text-3xl text-charcoal sm:text-4xl">{sheet.wedding.names || "The wedding"}</h1>
        <p className="mt-1 text-slate">
          {[sheet.wedding.venue, sheet.wedding.date ? longDate(sheet.wedding.date) : ""].filter(Boolean).join(" · ")}
        </p>
      </header>

      <section aria-labelledby="arrive" className="mb-6">
        <h2 id="arrive" className="text-lg text-charcoal">
          Arrive
        </h2>
        <p className="text-2xl text-charcoal tabular-nums">{sheet.arrival || "Not set yet"}</p>
        {sheet.people.length > 0 ? <p className="text-sm text-slate">Named: {sheet.people.join(", ")}</p> : null}
      </section>

      <section aria-labelledby="day" className="mb-6">
        <h2 id="day" className="text-lg text-charcoal">
          On the day
        </h2>
        {sheet.jobs.length === 0 ? (
          <p className="text-sm text-slate">Nothing on the running order for you yet.</p>
        ) : (
          <ol className="divide-y divide-charcoal/10">
            {sheet.jobs.map((job) => (
              <li key={`${job.when}-${job.label}`} className="flex gap-4 py-2">
                <span className="w-28 shrink-0 text-charcoal tabular-nums">{job.when}</span>
                <span>
                  <span className="block text-charcoal">{job.label}</span>
                  <span className="block text-sm text-slate">{[job.during, job.where].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {/* A sheet sealed before calendars were carried has none until the couple's app republishes it. */}
        {sheet.calendar && sheet.calendar.events.length > 0 && sheet.wedding.date ? (
          <div className="mt-3">
            <Button
              icon={CalendarPlus}
              onClick={() =>
                download(
                  `${slug(sheet.calendar.couple) || "wedding"}-${slug(sheet.calendar.tagLabel) || "day"}.ics`,
                  calendarFile(sheet.calendar, sheet.wedding.date, new Date()), "text/calendar;charset=utf-8")
              }
            >
              Add to calendar
            </Button>
          </div>
        ) : null}
      </section>

      {sheet.before.length > 0 ? (
        <section aria-labelledby="before" className="mb-6">
          <h2 id="before" className="text-lg text-charcoal">
            Before the day
          </h2>
          <ul className="divide-y divide-charcoal/10">
            {sheet.before.map((job) => (
              <li key={job.label} className="flex justify-between gap-4 py-2">
                <span className="text-charcoal">{job.label}</span>
                {job.by ? <span className="shrink-0 text-sm text-slate">by {job.by}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="confirm" className="rounded border border-charcoal/10 bg-stone/60 px-4 py-4">
        <h2 id="confirm" className="text-lg text-charcoal">
          Is this right?
        </h2>
        {confirmedCurrent ? (
          <p role="status" className="text-sm text-slate">
            You confirmed this on {confirmedOn}. Thank you.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate">
              {confirmedOn !== null ? `This has changed since you confirmed it on ${confirmedOn}. ` : ""}
              Confirming tells whoever sent this link that you have it, and when.
            </p>
            <Button icon={Check} tone="primary" disabled={confirming} onClick={() => void confirm()}>
              Confirm
            </Button>
            {notConfirmed ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {notConfirmed}
              </p>
            ) : null}
          </>
        )}
      </section>

      <footer className="mt-12 text-center text-xs text-slate">
        This page holds your times and jobs for this wedding, and nothing about its guests. It was updated{" "}
        {dayOf(publishedAt)}, and updates itself when they change.
      </footer>
    </main>
  );
}
