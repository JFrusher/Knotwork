"use client";

import { useCallback, useRef, useState } from "react";
import { CloudOff, Download, FileUp, History, Upload, X } from "lucide-react";
import { migrate } from "@jfrusher/knotwork";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { Button, Notice, Panel, TextField } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/Dialog";
import { useWriters } from "@/lib/model/useSuite";
import { reconcileLoadedDocument } from "@/lib/seating/normalise";
import { GuestLinkPanel } from "./GuestLinkPanel";
import { KeptCopies } from "./KeptCopies";
import { WeddingChoice } from "./WeddingChoice";
import { useGuestImport } from "./guestImportPanel";
import { useSyncPanel } from "./syncPanel";
import { readTextFile } from "@/lib/data/file";
import { downloadWedding } from "@/lib/data/backup";

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
  const status = useKnotworkStore((s) => s.status);
  const error = useKnotworkStore((s) => s.error);
  const saveError = useKnotworkStore((s) => s.saveError);
  const savedAt = useKnotworkStore((s) => s.savedAt);
  const replaceDocument = useKnotworkStore((s) => s.replaceDocument);
  const guestCount = useKnotworkStore((s) => Object.keys(s.doc.guests).length);
  const event = useKnotworkStore((s) => s.doc.event);
  const cloudStatus = useKnotworkStore((s) => s.cloudStatus);
  const cloudError = useKnotworkStore((s) => s.cloudError);
  const cloudConflicts = useKnotworkStore((s) => s.cloudConflicts);
  const showSync = useSyncPanel((s) => s.show);
  const { setEvent } = useWriters();

  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const showImport = useGuestImport((s) => s.show);
  const jsonInput = useRef<HTMLInputElement>(null);

  const exportJson = useCallback(() => {
    setProblem(null);
    try {
      downloadWedding();
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

      {/* First, when it is asked: nothing syncs until it is answered. */}
      <WeddingChoice />

      <Panel title="The wedding">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Each side of the family and every group shot is named after these. */}
          <TextField
            label="One of you"
            value={event.partners[0]}
            placeholder="Alex"
            onChange={(name) => setEvent({ partners: [name, event.partners[1]] })}
          />
          <TextField
            label="The other"
            value={event.partners[1]}
            placeholder="Sam"
            onChange={(name) => setEvent({ partners: [event.partners[0], name] })}
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
      {cloudStatus !== "disabled" && cloudStatus !== "choosing" ? (
        <Panel title="Cloud">
          {cloudStatus === "conflict" && cloudConflicts.length > 0 ? (
            <p className="text-sm text-slate">
              You and someone else changed the same {cloudConflicts.length === 1 ? "thing" : `${cloudConflicts.length} things`} at
              once. Everything else is merged; choose between the two side by side in Sync &amp; history.
            </p>
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
          <div className="mt-3">
            <Button
              icon={History}
              onClick={() => {
                onClose();
                showSync();
              }}
            >
              Sync &amp; history
            </Button>
          </div>
        </Panel>
      ) : null}

      {/*
        The guest link publishes a reduced, separately-keyed snapshot for
        people with no account — and here is where it is taken down.
      */}
      {/* Titled by its own panel ("A link for the guests"); wrapping it in a
          second one printed two headings for one section. */}
      <GuestLinkPanel />

      <KeptCopies onDone={setNotice} />

      <Panel title="Guest list">
        <p className="mb-3 text-sm text-slate">
          A CSV from wherever the replies arrived. You see exactly what changes before anything
          does — nobody is duplicated, and nobody is unseated.
        </p>
        <Button onClick={showImport} icon={FileUp}>
          Import guests
        </Button>
      </Panel>
    </div>
  );
}
