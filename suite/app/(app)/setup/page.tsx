"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardPaste, FileUp } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { eventChange } from "@/lib/model/useSuite";
import { readGuests } from "@/lib/model/slices";
import type { Guest } from "@/lib/model/types";
import { pastedHints, startingRoom, SEATS, tablesFor, withPasted, type StartingTable } from "@/lib/setup/draft";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { Button, TextField } from "@/components/ui/controls";
import { useGuestImport, type ImportTarget } from "@/components/shell/guestImportPanel";
import { WeddingPeople } from "@/components/shell/WeddingPeople";
import { EYEBROW } from "@/components/ui/eyebrow";

const STEPS = [
  { id: "you", title: "The two of you" },
  { id: "guests", title: "Your guests" },
  { id: "room", title: "The room" },
  { id: "together", title: "Planning together" },
] as const;
type Step = (typeof STEPS)[number]["id"];

interface Draft {
  partners: [string, string];
  date: string;
  venue: string;
  guests: Record<string, Guest>;
  seating: Record<string, unknown>;
}

/**
 * Setting the wedding up, in the order a couple would: who, then who is
 * coming, then where they sit, then who else plans it.
 *
 * Nothing is written until the room step: the first three are a draft,
 * committed as one change — one undo step, one push. The last step can leave
 * the page to sign in, so it comes after the commit, never before.
 */
export default function SetupPage() {
  const status = useKnotworkStore((s) => s.status);
  if (status !== "ready") return <div className="mx-auto mt-16 h-40 max-w-xl animate-pulse rounded-lg bg-stone" />;
  return <Setup />;
}

function Setup() {
  // From the wedding as it is: running setup again adds to it, and never
  // throws away what is there.
  const [draft, setDraft] = useState<Draft>(() => {
    const { doc, raw } = useKnotworkStore.getState();
    const seating = raw["seating"];
    return {
      partners: doc.event.partners,
      date: doc.event.date,
      venue: doc.event.venueName,
      guests: readGuests(doc),
      seating: typeof seating === "object" && seating !== null ? (seating as Record<string, unknown>) : {},
    };
  });
  const [step, setStep] = useState<Step>("you");
  const at = STEPS.findIndex((s) => s.id === step);
  const next = () => setStep(STEPS[at + 1]!.id);
  // The draft is written only at the room step: until then a reload or a
  // closed tab loses it, so the browser asks first.
  const started = useRef(draft);
  useWarnBeforeLeaving(step !== "together" && draft !== started.current);

  return (
    <div className="mx-auto max-w-xl px-6 py-12 sm:py-16">
      <p className={`text-slate ${EYEBROW}`}>Setting up</p>
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={s.id === step ? "step" : undefined} className={i === at ? "text-charcoal" : "text-slate"}>
            {i + 1}. {s.title}
          </li>
        ))}
      </ol>
      <h1 className="mt-6 font-display text-3xl text-charcoal">{STEPS[at]!.title}</h1>

      <div className="mt-6">
        {step === "you" ? <You draft={draft} setDraft={setDraft} onNext={next} /> : null}
        {step === "guests" ? <Guests draft={draft} setDraft={setDraft} onNext={next} /> : null}
        {step === "room" ? <Room draft={draft} onDone={next} /> : null}
        {step === "together" ? <Together /> : null}
      </div>
    </div>
  );
}

/** The browser's own "Leave site?" question, while `unsaved` holds. */
function useWarnBeforeLeaving(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [unsaved]);
}

interface StepProps {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onNext: () => void;
}

function You({ draft, setDraft, onNext }: StepProps) {
  const [a, b] = draft.partners;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <p className="text-sm text-slate">Every side of the family and every group shot is named after you.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="One of you" value={a} placeholder="Alex" onChange={(name) => setDraft((d) => ({ ...d, partners: [name, b] }))} />
        <TextField label="The other" value={b} placeholder="Sam" onChange={(name) => setDraft((d) => ({ ...d, partners: [a, name] }))} />
        <TextField label="Date" type="date" value={draft.date} onChange={(date) => setDraft((d) => ({ ...d, date }))} />
        <TextField label="Venue" value={draft.venue} placeholder="The barn" onChange={(venue) => setDraft((d) => ({ ...d, venue }))} />
      </div>
      <p className="text-sm text-slate">Any of these can wait — they are all in Data later.</p>
      <Button tone="primary" icon={ArrowRight} onClick={onNext}>
        Next
      </Button>
    </form>
  );
}

function Guests({ draft, setDraft, onNext }: StepProps) {
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [hints, setHints] = useState<ReturnType<typeof pastedHints> | null>(null);
  const showImport = useGuestImport((s) => s.showInto);
  const count = Object.keys(draft.guests).length;
  // Read at the moment the importer asks, so it always sees the draft as it is.
  const current = useRef(draft);
  current.current = draft;

  const intoDraft: ImportTarget = {
    read: () => ({
      event: { ...useKnotworkStore.getState().doc.event, partners: current.current.partners },
      guests: current.current.guests,
      seating: current.current.seating,
    }),
    commit: ({ guests, seating }) =>
      setDraft((d) => ({ ...d, guests: guests as Record<string, Guest>, seating: seating ?? d.seating })),
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate">
        {count > 0
          ? `${count} ${count === 1 ? "guest" : "guests"} so far.`
          : "A list from wherever the replies arrive — Joy, Zola, a spreadsheet — or just names."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button icon={FileUp} onClick={() => showImport(intoDraft)}>
          Import a file
        </Button>
        <Button icon={ClipboardPaste} onClick={() => setPasting(true)}>
          Paste names
        </Button>
      </div>
      {pasting ? (
        <div className="space-y-2">
          <label className="block text-sm text-slate" htmlFor="pasted-names">
            One name per line
          </label>
          <textarea
            id="pasted-names"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            className="w-full rounded border border-charcoal/15 bg-parchment p-2 text-sm text-charcoal"
          />
          <Button
            disabled={!text.trim()}
            onClick={() => {
              setDraft((d) => ({ ...d, guests: withPasted(text, d.guests, d.seating) as Record<string, Guest> }));
              setHints(pastedHints(text));
              setText("");
              setPasting(false);
            }}
          >
            Add them
          </Button>
        </div>
      ) : null}
      {hints ? <PasteHints {...hints} /> : null}
      <Button tone="primary" icon={ArrowRight} onClick={onNext}>
        {count > 0 ? "Next" : "Later — next"}
      </Button>
    </div>
  );
}

/** Worth a look after a paste; everything went in as typed. Fix them in Guests. */
function PasteHints({ repeated, several }: { repeated: string[]; several: string[] }) {
  if (repeated.length === 0 && several.length === 0) return null;
  const quoted = (names: string[]) => names.map((name) => `“${name}”`).join(" ");
  return (
    <div role="status" className="space-y-1 rounded border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-charcoal">
      {repeated.length > 0 ? <p>On the list more than once: {quoted(repeated)}.</p> : null}
      {several.length > 0 ? (
        <p>One guest and one seat each, though they may be more than one person: {quoted(several)}.</p>
      ) : null}
      <p className="text-slate">All added as typed. Change them in Guests.</p>
    </div>
  );
}

function Room({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const existing = Object.keys((draft.seating["tables"] as object | undefined) ?? {}).length;
  const guests = Object.keys(draft.guests).length;
  const [choice, setChoice] = useState<StartingTable | "later">(existing > 0 ? "later" : "round");

  function commit() {
    const { doc, setSlices } = useKnotworkStore.getState();
    const seating = choice === "later" ? draft.seating : startingRoom(draft.seating, choice, tablesFor(guests, choice));
    setSlices(
      [
        ...eventChange(doc, { partners: draft.partners, date: draft.date, venueName: draft.venue }),
        ["guests", draft.guests],
        ["seating", seating],
      ],
      { label: "setting up the wedding" },
    );
    onDone();
  }

  return (
    <div className="space-y-4">
      {existing > 0 ? (
        <p className="text-sm text-slate">
          The room already has {existing} {existing === 1 ? "table" : "tables"}. Seating is where they move.
        </p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-slate">
            A room to start from — every table can be moved, resized or removed in Seating.
          </legend>
          {(["round", "banquet"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-charcoal">
              <input type="radio" name="room" checked={choice === type} onChange={() => setChoice(type)} />
              {tablesFor(guests, type)} {type === "round" ? "round tables" : "long tables"} of {SEATS[type]}
              {guests > 0 ? ` for ${guests} guests` : ""}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="radio" name="room" checked={choice === "later"} onChange={() => setChoice("later")} />
            Not yet
          </label>
        </fieldset>
      )}
      <p className="text-sm text-slate">This saves everything from these steps, as one change you can undo.</p>
      <Button tone="primary" icon={ArrowRight} onClick={commit}>
        Save and continue
      </Button>
    </div>
  );
}

function Together() {
  const client = browserClient();
  const weddingId = useKnotworkStore((s) => s.weddingId);
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    if (!client) {
      setMe(null);
      return;
    }
    void client.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, [client]);

  const done = (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded border border-gold bg-gold/15 px-4 py-2 text-sm text-charcoal transition hover:bg-gold/25"
      >
        See where things stand
      </Link>
      <Link href="/seating" className="inline-flex min-h-11 items-center rounded border border-charcoal/15 px-4 py-2 text-sm text-charcoal transition hover:border-gold">
        Open Seating
      </Link>
    </div>
  );

  if (me === undefined) return <p className="text-slate">One moment…</p>;

  return (
    <div className="space-y-6">
      <p role="status" className="rounded border border-ok/40 bg-ok-soft px-3 py-2 text-sm text-charcoal">
        Saved on this device.
      </p>
      {!client ? null : me === null ? (
        <div className="space-y-3">
          <p className="text-sm text-slate">
            To plan it with your partner, or your planner, sign in: the wedding is kept on your
            account and on each of your devices. Nobody else reads it.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent("/account")}`}
            className="inline-flex min-h-11 items-center rounded border border-charcoal/15 px-4 py-2 text-sm text-charcoal transition hover:border-gold"
          >
            Sign in to share it
          </Link>
        </div>
      ) : weddingId ? (
        <div className="space-y-4">
          {notice ? (
            <p className={`rounded border px-3 py-2 text-sm text-charcoal ${notice.tone === "ok" ? "border-ok/40 bg-ok-soft" : "border-danger/40 bg-danger-soft"}`}>
              {notice.text}
            </p>
          ) : null}
          <WeddingPeople weddingId={weddingId} me={me} onNotice={(text, tone) => setNotice({ text, tone })} />
        </div>
      ) : null}
      {done}
    </div>
  );
}
