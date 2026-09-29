"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Phone } from "lucide-react";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { contacts, dayClock, findGuests, nowAndNext, runningOrder, takenKey, type BinderBlock } from "@/lib/binder/binder";
import { resolveShot } from "@/lib/ensemble/resolve";
import { readGuests, readSeating, readShots } from "@/lib/model/slices";
import { formatClock } from "@/apps/cadence/core/time/minutes";
import { longDate } from "@/lib/dates";

type Part = "now" | "day" | "ring" | "find" | "shots";
const PARTS: Array<{ id: Part; name: string }> = [
  { id: "now", name: "Now" },
  { id: "day", name: "Day" },
  { id: "ring", name: "Ring" },
  { id: "find", name: "Find" },
  { id: "shots", name: "Shots" },
];

/** A time as the day's own clock gives it: `13:45`, `00:40 +1`. */
const at = (minute: number) => formatClock(minute);

/**
 * The wedding on the day, on a phone: what is on now and next, the running
 * order, who to ring, where a guest sits, and the shots to tick off.
 *
 * It changes nothing in the wedding. Shots ticked off are kept on this phone
 * only — two people with the list open should not be able to disagree about
 * the wedding by doing it. And it works without signal, from the copy last
 * saved to this phone: see `binder-sw.js`.
 */
export function Binder() {
  const status = useTrousseauStore((s) => s.status);
  const doc = useTrousseauStore((s) => s.doc);
  const savedAt = useTrousseauStore((s) => s.savedAt);
  const [part, setPart] = useState<Part>("now");
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);

  // The clock moves on its own; a minute's resolution is all a day needs.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    void keepForOffline();
  }, []);

  const blocks = useMemo(() => runningOrder(doc), [doc]);
  const clock = dayClock(doc, blocks, now);

  if (status !== "ready") return <p className="p-6 text-slate">Opening the wedding…</p>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-parchment">
      <header className="border-b border-charcoal/10 px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl text-charcoal">{doc.event.coupleNames || "The wedding"}</h1>
          <Link href="/" className="text-sm text-slate underline">
            Planner
          </Link>
        </div>
        <p className="text-sm text-slate">
          {[doc.event.venueName, doc.event.date ? longDate(doc.event.date) : ""].filter(Boolean).join(" · ")}
        </p>
        <p role="status" className="mt-1 text-xs text-slate">
          {online ? "Kept up to date while there is signal." : "No signal — this is the copy on this phone."}
          {savedAt ? ` Saved at ${new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.` : ""}
        </p>
      </header>

      <nav aria-label="The Binder" className="sticky top-0 z-10 grid grid-cols-5 border-b border-charcoal/10 bg-parchment">
        {PARTS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={part === entry.id}
            onClick={() => setPart(entry.id)}
            className={`min-h-12 text-sm ${part === entry.id ? "border-b-2 border-gold text-charcoal" : "text-slate"}`}
          >
            {entry.name}
          </button>
        ))}
      </nav>

      <main className="flex-1 px-4 py-4">
        {part === "now" ? <Now blocks={blocks} clock={clock} /> : null}
        {part === "day" ? <Day blocks={blocks} minute={clock.phase === "on" ? clock.minute : null} /> : null}
        {part === "ring" ? <Ring /> : null}
        {part === "find" ? <Find /> : null}
        {part === "shots" ? <Shots /> : null}
      </main>
    </div>
  );
}

function Now({ blocks, clock }: { blocks: BinderBlock[]; clock: ReturnType<typeof dayClock> }) {
  if (blocks.length === 0) return <p className="text-slate">There is no running order yet. It is made in Timeline.</p>;
  if (clock.phase === "after") return <p className="text-lg text-charcoal">The day is over. Congratulations.</p>;
  if (clock.phase === "before") {
    return (
      <section aria-label="Now">
        <p className="text-lg text-charcoal">
          {clock.daysAway <= 1 ? "Tomorrow." : `In ${clock.daysAway} days.`} The day starts at {at(blocks[0]!.startMin)}.
        </p>
        <BlockList title="First" blocks={blocks.slice(0, 3)} />
      </section>
    );
  }
  const { now, next } = nowAndNext(blocks, clock.minute);
  return (
    <section aria-label="Now">
      <p className="text-sm text-slate">{at(clock.minute)} at the venue</p>
      {now.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {now.map((block) => (
            <li key={block.id} className="rounded-lg border-2 border-gold/60 px-4 py-3">
              <span className="block text-xl text-charcoal">{block.label}</span>
              <span className="block text-sm text-slate">
                {[block.location, `until ${at(block.endMin)}`, block.lane].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-lg text-charcoal">Nothing on this minute.</p>
      )}
      <BlockList title="Next" blocks={next} />
    </section>
  );
}

function BlockList({ title, blocks }: { title: string; blocks: BinderBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <>
      <h2 className="mt-6 text-sm tracking-[0.14em] text-slate uppercase">{title}</h2>
      <ul className="mt-2 divide-y divide-charcoal/10">
        {blocks.map((block) => (
          <li key={block.id} className="flex gap-3 py-2">
            <span className="w-16 shrink-0 text-charcoal tabular-nums">{at(block.startMin)}</span>
            <span>
              <span className="block text-charcoal">{block.label}</span>
              <span className="block text-xs text-slate">{[block.location, block.lane].filter(Boolean).join(" · ")}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Day({ blocks, minute }: { blocks: BinderBlock[]; minute: number | null }) {
  return (
    <section aria-label="The day">
      <ol className="divide-y divide-charcoal/10">
        {blocks.map((block) => {
          const past = minute !== null && block.endMin <= minute;
          const current = minute !== null && block.startMin <= minute && minute < block.endMin;
          return (
            <li key={block.id} aria-current={current ? "time" : undefined} className={`flex gap-3 py-2 ${past ? "opacity-60" : ""} ${current ? "bg-gold/10" : ""}`}>
              <span className="w-16 shrink-0 text-charcoal tabular-nums">{at(block.startMin)}</span>
              <span>
                <span className="block text-charcoal">{block.label}</span>
                <span className="block text-xs text-slate">{[block.location, block.lane].filter(Boolean).join(" · ")}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Ring() {
  const doc = useTrousseauStore((s) => s.doc);
  const people = useMemo(() => contacts(doc), [doc]);
  if (people.length === 0) return <p className="text-slate">No numbers yet. Suppliers’ numbers are kept in Timeline and Delegation.</p>;
  return (
    <section aria-label="Who to ring">
      <ul className="divide-y divide-charcoal/10">
        {people.map((contact) => (
          <li key={contact.phone} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-charcoal">{contact.name}</span>
              <span className="block text-xs text-slate capitalize">{contact.role}</span>
            </span>
            <a
              href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
              aria-label={`Ring ${contact.name}, ${contact.phone}`}
              className="flex min-h-11 items-center gap-2 rounded border border-charcoal/15 px-3 text-charcoal"
            >
              <Phone size={16} aria-hidden />
              {contact.phone}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Find() {
  const doc = useTrousseauStore((s) => s.doc);
  const [query, setQuery] = useState("");
  const found = useMemo(() => findGuests(doc, query), [doc, query]);
  return (
    <section aria-label="Find a guest">
      <input
        type="search"
        aria-label="A guest’s name"
        placeholder="A guest’s name"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded border border-charcoal/15 bg-parchment px-3 py-3 text-base text-charcoal focus:border-gold"
      />
      {query.trim() && found.length === 0 ? <p className="mt-3 text-slate">Nobody coming is called that.</p> : null}
      <ul className="mt-3 divide-y divide-charcoal/10">
        {found.map((guest) => (
          <li key={guest.id} className="flex justify-between gap-3 py-3">
            <span className="text-charcoal">{guest.name}</span>
            <span className="text-charcoal">{guest.table}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Shots() {
  const doc = useTrousseauStore((s) => s.doc);
  const weddingId = useTrousseauStore((s) => s.weddingId);
  const [taken, setTaken] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    try {
      setTaken(new Set(JSON.parse(localStorage.getItem(takenKey(weddingId)) ?? "[]") as string[]));
    } catch {
      setTaken(new Set());
    }
  }, [weddingId]);

  const sections = useMemo(() => {
    const shots = readShots(doc);
    const guests = readGuests(doc);
    const seating = readSeating(doc);
    return shots.sections.map((section) => ({
      id: section.id,
      name: section.name,
      shots: section.shots.map((shot) => ({
        id: shot.id,
        ...resolveShot(shot, guests, seating, shots.cast, shots.customRoles, doc.event),
      })),
    }));
  }, [doc]);

  const all = sections.flatMap((section) => section.shots);
  if (all.length === 0) return <p className="text-slate">No shot list yet. It is made in Group shots.</p>;

  const toggle = (id: string) => {
    const next = new Set(taken);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTaken(next);
    try {
      localStorage.setItem(takenKey(weddingId), JSON.stringify([...next]));
    } catch {
      // Private browsing, or storage full: the ticks last while the page is open.
    }
  };

  return (
    <section aria-label="The shot list">
      <p className="text-sm text-slate">
        {all.filter((shot) => taken.has(shot.id)).length} of {all.length} taken. Ticks stay on this phone.
      </p>
      {sections.map((section) => (
        <div key={section.id} className="mt-4">
          <h2 className="text-sm tracking-[0.14em] text-slate uppercase">{section.name}</h2>
          <ul className="mt-1 divide-y divide-charcoal/10">
            {section.shots.map((shot) => (
              <li key={shot.id}>
                <label className="flex min-h-12 items-start gap-3 py-2">
                  <input type="checkbox" checked={taken.has(shot.id)} onChange={() => toggle(shot.id)} className="mt-1 size-5" />
                  <span className={taken.has(shot.id) ? "text-slate line-through" : "text-charcoal"}>
                    <span className="block">{shot.label}</span>
                    <span className="block text-xs text-slate">{shot.people.map((person) => person.name).join(", ")}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * Keep this page for when there is no signal: register the worker that
 * serves it offline, and hand it every file this page loaded, so a reload
 * with no signal has all of them. The wedding itself is already on the
 * phone, in the browser's own storage.
 */
async function keepForOffline() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/binder-sw.js", { scope: "/binder" });
    const ready = await navigator.serviceWorker.ready;
    const files = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => new URL(url).origin === location.origin && !new URL(url).pathname.startsWith("/api/"));
    ready.active?.postMessage({ keep: [location.pathname, ...files] });
  } catch {
    // Without a worker the page still works; it just needs signal to open.
  }
}
