"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button, Check, Notice } from "@/components/ui/controls";
import { parseCsv, type CsvTable } from "@/lib/data/csv";
import { readTextFile } from "@/lib/data/file";
import {
  applyImport,
  guessMapping,
  guessRsvpMeaning,
  MAPPABLE_FIELDS,
  MAX_ROWS,
  planImport,
  rsvpAnswers,
  type FieldMapping,
} from "@/lib/data/guestImport";
import { guestName, readGuests } from "@/lib/model/slices";
import type { Guest, RsvpStatus } from "@/lib/model/types";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { useGuestImport } from "./guestImportPanel";

/**
 * The one way a guest list comes in.
 *
 * Three steps: the file, what its columns and RSVP answers mean, and a preview
 * of exactly what will change — who is new, who is updated, whose name is
 * shared so nobody can tell which they are, and who is on the list but not in
 * the file. Nothing is written until the last button, and nobody is removed or
 * unseated unless they are ticked.
 */
export function GuestImport() {
  const open = useGuestImport((s) => s.open);
  const hide = useGuestImport((s) => s.hide);
  return (
    <Dialog open={open} onClose={hide} labelledBy="guest-import-title">
      <Steps onClose={hide} />
    </Dialog>
  );
}

interface Loaded {
  name: string;
  table: CsvTable;
}

const MEANINGS: Array<{ value: RsvpStatus; label: string }> = [
  { value: "confirmed", label: "Coming" },
  { value: "declined", label: "Not coming" },
  { value: "pending", label: "No answer yet" },
];

function Steps({ onClose }: { onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [meaning, setMeaning] = useState<Record<string, RsvpStatus>>({});
  const [step, setStep] = useState<"file" | "columns" | "check" | "done">("file");
  const [problem, setProblem] = useState<string | null>(null);
  const [add, setAdd] = useState<Set<string>>(new Set());
  const [remove, setRemove] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function choose(file: File) {
    setProblem(null);
    try {
      const table = parseCsv(await readTextFile(file));
      if (table.rows.length === 0) throw new Error(`${file.name} has a header row and nothing under it.`);
      if (table.rows.length > MAX_ROWS) {
        throw new Error(`${file.name} has ${table.rows.length} rows — the most a guest list can hold is ${MAX_ROWS}.`);
      }
      const guessed = guessMapping(table.headers);
      setLoaded({ name: file.name, table });
      setMapping(guessed);
      setMeaning(guessRsvpMeaning(rsvpAnswers(table, guessed)));
      setStep("columns");
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    }
  }

  // Read when the preview is built, not before: the list may have changed
  // since the dialog opened.
  const plan = useMemo(() => {
    if (step !== "check" || !loaded || !mapping) return null;
    return planImport(loaded.table, mapping, meaning, readGuests(useTrousseauStore.getState().doc));
  }, [step, loaded, mapping, meaning]);

  function commit() {
    if (!plan) return;
    const store = useTrousseauStore.getState();
    const written = applyImport(plan, { add, remove }, store.raw["seating"]);
    store.setSlices(
      written.seating ? [["guests", written.guests], ["seating", written.seating]] : [["guests", written.guests]],
      { label: "the guest import" },
    );
    const parts = [
      `${plan.added.length + add.size} new`,
      `${plan.updated.length} updated`,
      remove.size > 0 ? `${remove.size} removed` : null,
    ].filter(Boolean);
    setSummary(`${parts.join(", ")}.`);
    setStep("done");
  }

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <div className="p-6 sm:p-8">
      <h2 id="guest-import-title" className="text-2xl">
        Import guests
      </h2>
      {problem ? (
        <div className="mt-4">
          <Notice tone="danger">{problem}</Notice>
        </div>
      ) : null}

      {step === "file" ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate">
            A CSV from wherever the replies arrived — Joy, Zola, The Knot, or your own spreadsheet.
            You will see exactly what changes before anything does.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => input.current?.click()} icon={FileUp} tone="primary">
              Choose a CSV file
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            aria-label="Guest list CSV"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void choose(file);
            }}
          />
        </div>
      ) : null}

      {step === "columns" && loaded && mapping ? (
        <div className="mt-4 space-y-5">
          <p className="text-sm text-slate">
            {loaded.table.rows.length} {loaded.table.rows.length === 1 ? "row" : "rows"} in {loaded.name}. Point
            each field at the right column — leave one blank and it is not imported.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MAPPABLE_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-slate">{label}</span>
                <select
                  value={mapping[key] ?? ""}
                  onChange={(e) => {
                    const next = { ...mapping, [key]: e.target.value || null };
                    setMapping(next);
                    if (key === "rsvp") setMeaning(guessRsvpMeaning(rsvpAnswers(loaded.table, next)));
                  }}
                  className="min-w-0 flex-1 rounded border border-charcoal/15 bg-parchment px-2 py-1 text-charcoal"
                >
                  <option value="">—</option>
                  {loaded.table.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {Object.keys(meaning).length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-xs tracking-widest text-slate uppercase">What the answers mean</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(meaning).map(([answer, status]) => (
                  <label key={answer} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-charcoal" title={answer}>
                      “{answer}”
                    </span>
                    <select
                      value={status}
                      onChange={(e) => setMeaning({ ...meaning, [answer]: e.target.value as RsvpStatus })}
                      className="rounded border border-charcoal/15 bg-parchment px-2 py-1 text-charcoal"
                    >
                      {MEANINGS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {!mapping.firstName && !mapping.fullName ? (
            <Notice tone="danger">Choose the column with the guests’ names — first name, or a whole name.</Notice>
          ) : null}
          <div className="flex gap-2">
            <Button
              onClick={() => setStep("check")}
              tone="primary"
              disabled={!mapping.firstName && !mapping.fullName}
            >
              See what will change
            </Button>
            <Button onClick={() => setStep("file")}>Back</Button>
          </div>
        </div>
      ) : null}

      {step === "check" && plan ? (
        <div className="mt-4 space-y-5">
          <p className="text-sm text-charcoal">
            {plan.added.length} new, {plan.updated.length} updated, {plan.unchanged} unchanged
            {plan.skipped > 0 ? `, and ${plan.skipped} ${plan.skipped === 1 ? "row" : "rows"} with no name skipped` : ""}.
            Nobody is unseated.
          </p>

          <Names title="New" guests={plan.added} />
          <Names title="Updated" guests={plan.updated} />

          {plan.ambiguous.length > 0 ? (
            <Choices
              title="Share a name with more than one guest already on your list"
              hint="Nothing says which of them these are, so none of them has been changed. Tick any who are someone new, to add them."
              guests={plan.ambiguous}
              chosen={add}
              onToggle={(id) => setAdd((s) => toggle(s, id))}
            />
          ) : null}

          {plan.missing.length > 0 ? (
            <Choices
              title="On your list, not in this file"
              hint="Kept unless you tick them. Ticked, they are removed from the wedding — and from their table and their groups."
              guests={plan.missing}
              chosen={remove}
              onToggle={(id) => setRemove((s) => toggle(s, id))}
            />
          ) : null}

          <div className="flex gap-2">
            <Button onClick={commit} tone="primary" icon={FileUp}>
              Import
            </Button>
            <Button onClick={() => setStep("columns")}>Back</Button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="mt-4 space-y-4">
          <Notice tone="ok">Imported: {summary}</Notice>
          <Button onClick={onClose} tone="primary">
            Done
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Names({ title, guests }: { title: string; guests: Guest[] }) {
  if (guests.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 text-xs tracking-widest text-slate uppercase">
        {title} ({guests.length})
      </h3>
      <p className="max-h-24 overflow-auto text-sm text-slate">{guests.map(guestName).join(", ")}</p>
    </section>
  );
}

function Choices({
  title,
  hint,
  guests,
  chosen,
  onToggle,
}: {
  title: string;
  hint: string;
  guests: Guest[];
  chosen: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs tracking-widest text-slate uppercase">
        {title} ({guests.length})
      </legend>
      <p className="mb-2 text-sm text-slate">{hint}</p>
      <ul className="max-h-48 space-y-1 overflow-auto rounded border border-charcoal/10 p-2">
        {guests.map((guest) => (
          <li key={guest.id}>
            <Check label={guestName(guest)} checked={chosen.has(guest.id)} onChange={() => onToggle(guest.id)} />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
