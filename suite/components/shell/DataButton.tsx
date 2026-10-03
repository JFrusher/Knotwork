"use client";

import { Database } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { saveState, type SaveTone } from "@/lib/store/saveState";

/**
 * The Data button, which is also where the header says whether the wedding is
 * saved.
 *
 * On the button rather than beside it: the Data panel is where a failed save,
 * a conflict with a partner and a lost connection are each dealt with, and the
 * header is one row that the tools fill with their own controls. A separate
 * pill pushed Timeline's Present button off the end at 1440px.
 *
 * Quiet while all is well — a dot on the icon, and the tooltip. When something
 * needs the couple, the button takes the warning's colour and its words: it
 * reads "Not saved" instead of "Data". It used to turn red only for a wedding
 * that could not be read, and looked the same after a failed save as after a
 * good one.
 */

const DOT: Record<SaveTone, string> = {
  ok: "bg-ok",
  busy: "bg-slate animate-pulse",
  warn: "bg-warn",
  danger: "bg-danger",
};

const BUTTON = {
  quiet: "border-charcoal/15 text-slate hover:border-gold hover:text-charcoal",
  warn: "border-warn/50 bg-warn-soft text-charcoal hover:border-warn",
  danger: "border-danger/50 bg-danger-soft text-charcoal hover:border-danger",
};

export function DataButton({ onOpen }: { onOpen: () => void }) {
  const state = useKnotworkStore(
    useShallow((s) =>
      saveState({
        status: s.status,
        error: s.error,
        saveError: s.saveError,
        savedAt: s.savedAt,
        cloudStatus: s.cloudStatus,
        cloudError: s.cloudError,
      }),
    ),
  );
  const needsYou = state.tone === "warn" || state.tone === "danger";

  return (
    <>
      <button
        type="button"
        data-tour="shell.data"
        onClick={onOpen}
        title={state.detail}
        aria-label={needsYou ? `${state.label}. ${state.detail} Open Data.` : `Data. ${state.detail}`}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm transition ${
          needsYou ? BUTTON[state.tone as "warn" | "danger"] : BUTTON.quiet
        }`}
      >
        <span className="relative">
          <Database size={15} />
          <span
            aria-hidden
            className={`absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-1 ring-parchment ${DOT[state.tone]}`}
          />
        </span>
        {/* The word stays in the accessible name when it does not fit on screen. */}
        <span className="sr-only sm:not-sr-only">{needsYou ? state.label : "Data"}</span>
      </button>
      {/* Announced only when it needs someone. "Synced" after every keystroke
          would be read aloud after every keystroke. */}
      <span role="status" className="sr-only">
        {needsYou ? `${state.label}. ${state.detail}` : ""}
      </span>
    </>
  );
}
