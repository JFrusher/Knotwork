"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Something to look at or act on without losing your place: a panel along the
 * right edge, one width everywhere.
 *
 * A native modal `<dialog>`, as `Dialog` is and for the same reasons — the
 * page behind goes inert, Escape closes it, focus comes back to what opened
 * it — placed at the edge instead of the middle.
 */
export function SlideOver({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The id of the heading inside that names the panel. */
  labelledBy: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={panel}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-l border-charcoal/10 bg-parchment text-slate shadow-2xl backdrop:bg-charcoal/30"
    >
      {open ? children : null}
    </dialog>
  );
}
