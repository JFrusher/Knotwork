"use client";

import { useCallback, useRef, useState } from "react";
import { CloudOff, Download, FileUp, RefreshCw, Upload, X } from "lucide-react";
import { migrate, serialise, suggestedFilename } from "@jfrusher/trousseau";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { Button, Notice, Panel, TextField } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/Dialog";
import { readGuests } from "@/lib/model/slices";
import { useWriters } from "@/lib/model/useSuite";
import { reconcileLoadedDocument } from "@/lib/seating/normalise";
import { parseCsv, type CsvTable } from "@/lib/data/csv";
import { GuestLinkPanel } from "./GuestLinkPanel";
import { download, readTextFile } from "@/lib/data/file";
import {
  guessMapping,
  MAPPABLE_FIELDS,
  rowsToGuests,
  type FieldMapping,
} from "@/lib/data/guestImport";

/**
 * Everything that moves data in or out of the machine, in one place.
 *
 * There is no server to hold a backup, so the export button is the only copy
 * the user will ever have — it is the first thing in here, it takes one press,
 * and it writes the whole document rather than a slice.
 */
export function DataManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="data-manager-title">
      <Body onClose={onClose} />
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const status = useTrousseauStore((s) => s.status);
  const error = useTrousseauStore((s) => s.error);
  const saveError = useTrousseauStore((s) => s.saveError);
  const savedAt = useTrousseauStore((s) => s.savedAt);
  const replaceDocument = useTrousseauStore((s) => s.replaceDocument);
  const guestCount = useTrousseauStore((s) => Object.keys(s.doc.guests).length);
  const event = useTrousseauStore((s) => s.doc.event);
  const cloudStatus = useTrousseauStore((s) => s.cloudStatus);
  const cloudError = useTrousseauStore((s) => s.cloudError);
  const cloudConflicts = useTrousseauStore((s) => s.cloudConflicts);
  const resolveConflict = useTrousseauStore((s) => s.resolveConflict);
  const { setEvent, setGuests } = useWriters();

  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<{ table: CsvTable; mapping: FieldMapping } | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const exportJson = useCallback(() => {
    setProblem(null);
    try {
      const raw = useTrousseauStore.getState().raw;
      const doc = migrate(raw);
      download(suggestedFilename(doc), serialise(doc));
      setNotice("Backup written to your downloads.");
    } catch (cause) {
      setProblem(
        `That could not be exported: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }, []);

  const importJson = useCallback(
    async (file: File) => {
      setProblem(null);
      setNotice(null);
      try {
        const parsed: unknown = JSON.parse(await readTextFile(file));
        // Through the contract's own reader, so a file it would refuse never
        // reaches the store — and so a restore cannot be a silent downgrade.
        migrate(parsed);
        replaceDocument(parsed);
        // A restored file may record a seat on the table and not on the guest.
        reconcileLoadedDocument();
        setNotice(`Restored from ${file.name}.`);
      } catch (cause) {
        setProblem(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [replaceDocument],
  );

  const stageCsv = useCallback(async (file: File) => {
    setProblem(null);
    setNotice(null);
    try {
      const table = parseCsv(await readTextFile(file));
      if (table.rows.length === 0) {
        setProblem(`${file.name} has a header row and nothing under it.`);
        return;
      }
      setPending({ table, mapping: guessMapping(table.headers) });
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const commitCsv = useCallback(() => {
    if (!pending) return;
    const existing = readGuests(useTrousseauStore.getState().doc);
    const result = rowsToGuests(pending.table, pending.mapping, existing);
    setGuests(result.guests);
    const added = Object.keys(result.guests).length - Object.keys(existing).length;
    setPending(null);
    setNotice(
      `${added} new, ${pending.table.rows.length - result.skipped - added} updated` +
        (result.skipped > 0 ? `, ${result.skipped} skipped with no name.` : "."),
    );
  }, [pending, setGuests]);

  return (
    <div className="p-6 sm:p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 id="data-manager-title" className="text-2xl">
            Your data
          </h2>
          <p className="mt-1 text-sm text-slate">
            {guestCount} {guestCount === 1 ? "guest" : "guests"} on this device
            {savedAt ? `, saved ${new Date(savedAt).toLocaleTimeString()}` : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-slate transition hover:bg-stone hover:text-charcoal"
        >
          <X size={20} />
        </button>
      </header>

      {status === "error" ? (
        <Notice tone="danger">
          {error} Nothing has been written over it — export a backup below and restore a good copy.
        </Notice>
      ) : null}
      {saveError ? (
        <Notice tone="danger">
          {saveError} What is on screen has not been stored on this device — export a backup
          below before closing this page.
        </Notice>
      ) : null}
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      <Panel title="The wedding">
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="Names"
            value={event.coupleNames}
            placeholder="Charis & Jacob"
            onChange={(coupleNames) => setEvent({ coupleNames })}
          />
          <TextField
            label="Date"
            type="date"
            value={event.date}
            onChange={(date) => setEvent({ date })}
          />
          <TextField
            label="Venue"
            value={event.venueName}
            placeholder="The barn"
            onChange={(venueName) => setEvent({ venueName })}
          />
        </div>
      </Panel>

      <Panel title="Backup">
        <p className="mb-3 text-sm text-slate">
          One file holding the whole wedding — guests, seating, the day, the crew and the
          stationery. It never leaves this machine unless you send it somewhere.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson} icon={Download} tone="primary">
            Export backup
          </Button>
          <Button onClick={() => jsonInput.current?.click()} icon={Upload}>
            Restore from file
          </Button>
          <input
            ref={jsonInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importJson(file);
            }}
          />
        </div>
      </Panel>

      {/*
        Absent entirely without an account. `cloudStatus` is "disabled" until
        `startCloudSync` finds both a configured deployment and a wedding, so
        the local-only user never sees a section about a cloud they have not
        opted into.
      */}
      {cloudStatus !== "disabled" ? (
        <Panel title="Cloud">
          {cloudStatus === "conflict" && cloudConflicts.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate">
                You and your partner both changed the same thing on different devices. Choose
                which to keep for each — nothing else is affected.
              </p>
              {cloudConflicts.map((conflict) => (
                <div key={conflict.slice} className="rounded border border-charcoal/10 p-3">
                  <p className="mb-2 text-sm font-semibold capitalize">{conflict.slice}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => resolveConflict(conflict.slice, "theirs")}
                      icon={RefreshCw}
                      tone="primary"
                    >
                      Use their version
                    </Button>
                    <Button onClick={() => resolveConflict(conflict.slice, "mine")} icon={Upload}>
                      Keep mine
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : cloudStatus === "queued" ? (
            <p className="flex items-center gap-2 text-sm text-slate">
              <CloudOff size={16} /> You&rsquo;re offline. Changes will sync once you&rsquo;re back
              online.
            </p>
          ) : cloudStatus === "error" ? (
            <p className="text-sm text-slate">{cloudError ?? "The cloud could not be reached."}</p>
          ) : (
            <p className="text-sm text-slate">Synced to your account.</p>
          )}
        </Panel>
      ) : null}

      {/*
        The guest link outlives the passphrase sync it used to sit beside: it
        publishes a reduced, separately-keyed snapshot for people with no
        account. Without it on screen nobody can take down a link they have
        already published, which is the half of it that matters.
      */}
      {/* Titled by its own panel ("A link for the guests"); wrapping it in a
          second one printed two headings for one section. */}
      <GuestLinkPanel onProblem={setProblem} />

      <Panel title="Guest list">
        {pending ? (
          <CsvMapping
            table={pending.table}
            mapping={pending.mapping}
            onChange={(mapping) => setPending({ table: pending.table, mapping })}
            onCancel={() => setPending(null)}
            onCommit={commitCsv}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-slate">
              A CSV from wherever the replies arrived. Columns are guessed and yours to correct.
              People already on the list are matched by name and updated, never duplicated — and
              a re-import never unseats anybody.
            </p>
            <Button onClick={() => csvInput.current?.click()} icon={FileUp}>
              Upload CSV
            </Button>
            <input
              ref={csvInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void stageCsv(file);
              }}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

function CsvMapping({
  table,
  mapping,
  onChange,
  onCancel,
  onCommit,
}: {
  table: CsvTable;
  mapping: FieldMapping;
  onChange: (next: FieldMapping) => void;
  onCancel: () => void;
  onCommit: () => void;
}) {
  const named = table.rows.length;
  return (
    <div>
      <p className="mb-3 text-sm text-slate">
        {named} {named === 1 ? "row" : "rows"} read. Point each field at the right column — leave
        one blank and it is simply not imported.
      </p>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {MAPPABLE_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 text-slate">{label}</span>
            <select
              value={mapping[key] ?? ""}
              onChange={(e) => onChange({ ...mapping, [key]: e.target.value || null })}
              className="min-w-0 flex-1 rounded border border-charcoal/15 bg-parchment px-2 py-1 text-charcoal"
            >
              <option value="">—</option>
              {table.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={onCommit} icon={FileUp} tone="primary">
          Import {named} {named === 1 ? "row" : "rows"}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
