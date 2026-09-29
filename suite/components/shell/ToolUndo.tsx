"use client";

import { Redo2, Undo2 } from "lucide-react";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { ChromeFill } from "./chrome";

/**
 * The undo control in the header, on the pages and tools that edit the
 * wedding.
 *
 * One pair of buttons rather than four, because two undo buttons on one screen
 * is worse than either alone. Every tool and page now edits the wedding itself
 * and keeps no history of its own, so there is one history to drive: the
 * wedding's. It is shared, so the next undo may take back an edit made in
 * another tool; each step says what it takes back ("Undo rename table"),
 * which is the difference between a safe button and a surprise.
 */
export function ToolUndo() {
  const past = useTrousseauStore((s) => s.past);
  const future = useTrousseauStore((s) => s.future);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const undoLabel = past[past.length - 1]?.label;
  const redoLabel = future[future.length - 1]?.label;
  const undoText = canUndo ? `Undo${undoLabel ? ` ${undoLabel}` : ""}` : "Nothing to undo";
  const redoText = canRedo ? `Redo${redoLabel ? ` ${redoLabel}` : ""}` : "Nothing to redo";

  return (
    <ChromeFill name="tool-undo">
      <button
        type="button"
        onClick={() => useTrousseauStore.getState().undo()}
        disabled={!canUndo}
        title={undoText}
        aria-label={undoText}
        className="rounded p-1.5 text-slate transition hover:bg-stone hover:text-charcoal disabled:pointer-events-none disabled:opacity-30"
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        onClick={() => useTrousseauStore.getState().redo()}
        disabled={!canRedo}
        title={redoText}
        aria-label={redoText}
        className="rounded p-1.5 text-slate transition hover:bg-stone hover:text-charcoal disabled:pointer-events-none disabled:opacity-30"
      >
        <Redo2 size={16} />
      </button>
    </ChromeFill>
  );
}
