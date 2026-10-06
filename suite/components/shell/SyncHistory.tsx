"use client";

import { useEffect, useRef, useState } from "react";
import { History, X } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { useCopies } from "@/lib/store/copies";
import { saveState } from "@/lib/store/saveState";
import { fetchHistory, fetchHistoryDocument, type HistoryListing } from "@/lib/documents/cloudSync";
import { describeChanges, fieldChanges, partName } from "@/lib/documents/describe";
import type { PartConflict } from "@/lib/documents/mergeCloudDocument";
import { Button } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/Confirm";
import { SlideOver } from "@/components/ui/SlideOver";
import { EYEBROW } from "@/components/ui/eyebrow";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const who = (entry: HistoryListing) => (entry.yours ? "You" : (entry.savedBy ?? "Someone no longer on this wedding"));

/**
 * Where the wedding stands with the account: anything two people changed at
 * once, laid side by side to choose between, and the versions the account has
 * kept — who saved each, what changed in it, and a way to put one back.
 */
export function SyncHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SlideOver open={open} onClose={onClose} labelledBy="sync-title">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-4">
          <h2 id="sync-title" className="font-display text-2xl text-charcoal">
            Sync &amp; history
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1.5 text-slate hover:bg-stone hover:text-charcoal">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5">
          <Now />
          <Conflicts />
          <Versions onRestored={onClose} />
        </div>
      </div>
    </SlideOver>
  );
}

function Now() {
  const state = useKnotworkStore(
    useShallow((s) =>
      saveState({ status: s.status, error: s.error, saveError: s.saveError, savedAt: s.savedAt, cloudStatus: s.cloudStatus, cloudError: s.cloudError }),
    ),
  );
  return (
    <section aria-label="Now">
      <p className="text-sm text-charcoal">{state.detail}</p>
    </section>
  );
}

function Conflicts() {
  const conflicts = useKnotworkStore((s) => s.cloudConflicts);
  const resolve = useKnotworkStore((s) => s.resolveConflict);
  if (conflicts.length === 0) return null;
  return (
    <section aria-labelledby="conflicts-title">
      <h3 id="conflicts-title" className={`text-slate ${EYEBROW}`}>
        Changed on both sides
      </h3>
      <p className="mt-2 text-sm text-slate">
        You and someone else changed the same thing before either saw the other’s change. For each, keep one; everything
        else was merged already.
      </p>
      <ul className="mt-3 space-y-3">
        {conflicts.map((conflict) => (
          <ConflictRow key={conflict.key} conflict={conflict} onChoose={(choice) => resolve(conflict.key, choice)} />
        ))}
      </ul>
    </section>
  );
}

function ConflictRow({ conflict, onChoose }: { conflict: PartConflict; onChoose: (choice: "mine" | "theirs") => void }) {
  const name = partName(conflict.key, conflict.mine ?? conflict.theirs);
  const changes = fieldChanges(conflict.mine, conflict.theirs);
  return (
    <li className="rounded-lg border border-warn/40 bg-parchment p-3">
      <p className="text-sm text-charcoal">{name}</p>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-slate">
          <tr>
            <th scope="col" className="py-1 font-normal">
              What
            </th>
            <th scope="col" className="py-1 font-normal">
              Yours
            </th>
            <th scope="col" className="py-1 font-normal">
              Theirs
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.field} className="border-t border-charcoal/10 text-charcoal">
              <th scope="row" className="py-1 pr-2 font-normal text-slate">
                {change.field}
              </th>
              <td className="py-1 pr-2">{change.mine}</td>
              <td className="py-1">{change.theirs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => onChoose("mine")}>Keep yours</Button>
        <Button tone="primary" onClick={() => onChoose("theirs")}>
          Use theirs
        </Button>
      </div>
    </li>
  );
}

type Changes = { status: "loading" } | { status: "ready"; lines: string[] } | { status: "failed"; message: string };

function Versions({ onRestored }: { onRestored: () => void }) {
  const weddingId = useKnotworkStore((s) => s.weddingId);
  const cloudStatus = useKnotworkStore((s) => s.cloudStatus);
  const confirm = useConfirm();
  const [entries, setEntries] = useState<HistoryListing[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, Changes>>({});
  // Each version is fetched once, however often it is looked at.
  const documents = useRef(new Map<string, Promise<Record<string, unknown>>>());

  useEffect(() => {
    if (!weddingId) return;
    let current = true;
    fetchHistory(weddingId).then(
      (found) => current && setEntries(found),
      (error: unknown) => current && setProblem(error instanceof Error ? error.message : "The history could not be loaded."),
    );
    return () => {
      current = false;
    };
  }, [weddingId]);

  if (cloudStatus === "disabled" || !weddingId) {
    return (
      <section aria-labelledby="versions-title">
        <h3 id="versions-title" className={`text-slate ${EYEBROW}`}>
          Saved versions
        </h3>
        <p className="mt-2 text-sm text-slate">
          An account keeps earlier versions of the wedding — one for every ten minutes each of you spends on it, and past a month one a day — and who saved each. This wedding is on this device only.
        </p>
      </section>
    );
  }

  const version = (id: string) => {
    const known = documents.current.get(id);
    if (known) return known;
    const loading = fetchHistoryDocument(weddingId, id);
    documents.current.set(id, loading);
    return loading;
  };

  const look = async (index: number) => {
    const entry = entries![index]!;
    const previous = entries![index + 1];
    setChanges((was) => ({ ...was, [entry.id]: { status: "loading" } }));
    try {
      const [after, before] = await Promise.all([version(entry.id), previous ? version(previous.id) : Promise.resolve(null)]);
      const lines = before === null ? ["The earliest version kept."] : describeChanges(before, after);
      setChanges((was) => ({ ...was, [entry.id]: { status: "ready", lines: lines.length > 0 ? lines : ["Nothing a person would notice."] } }));
    } catch (error) {
      setChanges((was) => ({ ...was, [entry.id]: { status: "failed", message: error instanceof Error ? error.message : "It could not be loaded." } }));
    }
  };

  const putBack = async (entry: HistoryListing) => {
    const ok = await confirm({
      title: "Put this version back?",
      body: (
        <>
          <p>The wedding goes back to how it was at {when(entry.savedAt)}, for everyone on it.</p>
          <p>As it is now, it is kept on this device first, and can be put back from Data.</p>
        </>
      ),
      action: "Put it back",
    });
    if (!ok) return;
    const document = await version(entry.id);
    const { raw, replaceDocument } = useKnotworkStore.getState();
    await useCopies.getState().keep(raw, `Before putting back the version from ${when(entry.savedAt)}`);
    replaceDocument(document, { label: "putting back a saved version" });
    onRestored();
  };

  return (
    <section aria-labelledby="versions-title">
      <h3 id="versions-title" className={`text-slate ${EYEBROW}`}>
        Saved versions
      </h3>
      {problem ? (
        <p className="mt-2 text-sm text-danger">{problem}</p>
      ) : entries === null ? (
        <p className="mt-2 text-sm text-slate">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-sm text-slate">Nothing has been saved to the account yet.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {entries.map((entry, index) => {
            const seen = changes[entry.id];
            return (
              <li key={entry.id} className="rounded-lg border border-charcoal/10 bg-parchment p-3">
                <p className="flex items-center gap-2 text-sm text-charcoal">
                  <History size={14} aria-hidden className="text-slate" />
                  {when(entry.savedAt)} · {who(entry)}
                  {index === 0 ? <span className="text-xs text-slate">(now)</span> : null}
                </p>
                {seen?.status === "ready" ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-slate">
                    {seen.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : seen?.status === "loading" ? (
                  <p className="mt-2 text-xs text-slate">Loading…</p>
                ) : seen?.status === "failed" ? (
                  <p className="mt-2 text-xs text-danger">{seen.message}</p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  {seen ? null : <Button onClick={() => void look(index)}>What changed</Button>}
                  {index === 0 ? null : <Button onClick={() => void putBack(entry)}>Put this version back</Button>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
