"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A decision, or a short flow that must be finished or cancelled.
 *
 * A native modal `<dialog>`, because it is the one that behaves as a dialog
 * without being taught to: the page behind goes inert so Tab stays inside,
 * Escape closes it, and focus returns to whatever opened it. The hand-built
 * overlays this replaces said `aria-modal` and did none of those things.
 *
 * The body is rendered only while open, so a dialog's own state starts fresh
 * each time and nothing inside it runs while it is closed.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  width = "max-w-2xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The id of the heading inside that names the dialog. */
  labelledBy: string;
  width?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelledBy}
      // Fires for Escape as well as for `close()`, so the owner's state
      // follows however the dialog was dismissed.
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`mx-auto my-8 w-[calc(100%-2rem)] ${width} rounded-lg border border-charcoal/10 bg-parchment text-slate shadow-2xl backdrop:bg-charcoal/40`}
    >
      {open ? children : null}
    </dialog>
  );
}
