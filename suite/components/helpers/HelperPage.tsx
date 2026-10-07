"use client";

import { useEffect, useState } from "react";
import { localDay, longDate } from "@/lib/dates";
import { keepForOffline } from "@/lib/offline";
import { importShareKey, unseal } from "@/lib/share/crypto";
import type { HelperSheet } from "@/lib/helpers/helperSheet";
import type { SealedSheet } from "@/lib/helpers/store";

/** Where this phone keeps the sheet it last opened, for when there is no signal. */
const keptKey = (token: string) => `knotwork.helper.${token}`;

interface Kept {
  sheet: HelperSheet;
  publishedAt: string;
}

function readKept(token: string): Kept | null {
  try {
    return JSON.parse(localStorage.getItem(keptKey(token)) ?? "null") as Kept | null;
  } catch {
    return null;
  }
}

function keep(token: string, kept: Kept | null): void {
  try {
    if (kept) localStorage.setItem(keptKey(token), JSON.stringify(kept));
    else localStorage.removeItem(keptKey(token));
  } catch {
    // Private browsing, or storage full: it still opens while there is signal.
  }
}

/**
 * The page a day-of helper's link opens: the run of the day, their jobs and
 * their team's, the boxes, the photos, and the crew's numbers.
 *
 * As the suppliers' page: the key is in the URL fragment, which the browser
 * never sends, so the host holding the sheet cannot read it. Once opened it is
 * kept on the phone, so it opens with no signal at the venue. A link taken
 * down or run out removes that copy the next time it is opened with signal.
 */
export function HelperPage({ token }: { token: string }) {
  const [kept, setKept] = useState<Kept | null>(null);
  const [offline, setOffline] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
      let response: Response;
      try {
        response = await fetch(`/api/helpers/${token}`);
      } catch {
        // No signal: the copy from the last time it opened, if there is one.
        const held = readKept(token);
        if (!live) return;
        if (held) {
          setKept(held);
          setOffline(true);
        } else setProblem("There is no signal, and this link has not been opened on this phone before.");
        return;
      }
      try {
        if (!response.ok) {
          keep(token, null);
          if (live) setProblem("This link is not live. Ask whoever sent it for a new one.");
          return;
        }
        const sealed = (await response.json()) as SealedSheet;
        const opened = { sheet: (await unseal(await importShareKey(key), sealed)) as HelperSheet, publishedAt: sealed.publishedAt };
        keep(token, opened);
        if (!live) return;
        setKept(opened);
        void keepForOffline("/helper/");
      } catch {
        if (live) setProblem("This link could not be opened. Copy the whole link and try again.");
      }
    })();

    return () => {
      live = false;
    };
  }, [token]);

  if (problem) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="mb-3 text-2xl">Not this link</h1>
        <p className="text-slate">{problem}</p>
      </main>
    );
  }

  if (!kept) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-slate">Opening…</p>
      </main>
    );
  }

  const { sheet, publishedAt } = kept;
  const shots = sheet.shots.filter((section) => section.shots.length > 0);

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-sm text-slate">For {[sheet.helper.name, sheet.helper.team].filter(Boolean).join(", ")}</p>
        <h1 className="font-display text-3xl text-charcoal sm:text-4xl">{sheet.wedding.names || "The wedding"}</h1>
        <p className="mt-1 text-slate">
          {[sheet.wedding.venue, sheet.wedding.date ? longDate(sheet.wedding.date) : ""].filter(Boolean).join(" · ")}
        </p>
        {offline ? (
          <p role="status" className="mt-3 rounded border border-charcoal/10 bg-stone/60 px-3 py-2 text-sm text-charcoal">
            No signal. This is the copy on your phone from {longDate(localDay(new Date(publishedAt)))}.
          </p>
        ) : null}
      </header>

      <section aria-labelledby="jobs" className="mb-8">
        <h2 id="jobs" className="text-lg text-charcoal">
          Your jobs
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
                  <span className="block text-sm text-slate">{[job.where, job.who.join(", ")].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="day" className="mb-8">
        <h2 id="day" className="text-lg text-charcoal">
          The day
        </h2>
        <ol className="divide-y divide-charcoal/10">
          {sheet.day.map((block) => (
            <li key={`${block.when}-${block.label}`} className="flex gap-4 py-2">
              <span className="w-28 shrink-0 text-charcoal tabular-nums">{block.when}</span>
              <span>
                <span className="block text-charcoal">{block.label}</span>
                {block.where ? <span className="block text-sm text-slate">{block.where}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {sheet.boxes.length > 0 ? (
        <section aria-labelledby="boxes" className="mb-8">
          <h2 id="boxes" className="text-lg text-charcoal">
            The boxes
          </h2>
          <ul className="divide-y divide-charcoal/10">
            {sheet.boxes.map((box) => (
              <li key={box.number} className="py-2">
                <span className="block text-charcoal">
                  {box.number}. {box.name}
                </span>
                <span className="block text-sm text-slate">{[box.where, box.takenBy.join(", ")].filter(Boolean).join(" · ")}</span>
                {box.items.length > 0 ? <span className="block text-sm text-charcoal">{box.items.join(", ")}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {shots.length > 0 ? (
        <section aria-labelledby="shots" className="mb-8">
          <h2 id="shots" className="text-lg text-charcoal">
            The photos
          </h2>
          {shots.map((section) => (
            <div key={section.section} className="mb-3">
              <h3 className="text-sm text-slate">{section.section}</h3>
              <ol className="divide-y divide-charcoal/10">
                {section.shots.map((shot, index) => (
                  <li key={`${index}-${shot.label}`} className="py-2">
                    <span className="block text-charcoal">{shot.label}</span>
                    <span className="block text-sm text-slate">{shot.names.join(", ")}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      ) : null}

      {sheet.crew.length > 0 ? (
        <section aria-labelledby="ring" className="mb-8">
          <h2 id="ring" className="text-lg text-charcoal">
            Numbers to ring
          </h2>
          <ul className="divide-y divide-charcoal/10">
            {sheet.crew.map((contact) => (
              <li key={contact.phone} className="flex justify-between gap-4 py-2">
                <span>
                  <span className="block text-charcoal">{contact.name}</span>
                  <span className="block text-sm text-slate">{contact.role}</span>
                </span>
                <a
                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                  aria-label={`Ring ${contact.name}, ${contact.phone}`}
                  className="shrink-0 text-charcoal underline underline-offset-4 tabular-nums"
                >
                  {contact.phone}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-12 text-center text-xs text-slate">
        This page holds the day, your jobs and the crew&rsquo;s numbers, and nothing about the guests beyond the names in the
        photos. It was updated {longDate(localDay(new Date(publishedAt)))}, and{" "}
        {sheet.wedding.date ? "stops working the day after the wedding." : "works until whoever sent it takes it down."}
      </footer>
    </main>
  );
}
