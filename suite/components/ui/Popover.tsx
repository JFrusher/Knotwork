"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Picking something small, anchored to the button that opened it.
 *
 * A disclosure — a button that shows and hides a panel — rather than an ARIA
 * menu: what goes in one here is links, and a list of links is navigation,
 * which a screen reader already knows how to read. A menu role would promise
 * arrow-key handling that links do not need.
 *
 * It closes on Escape (handing focus back to its button), on a click or a Tab
 * outside it, and on following a link inside it — the page may not change on a
 * link to where you already are, and the panel should not outlive the choice.
 */
export function Popover({
  label,
  buttonClassName,
  align = "start",
  children,
}: {
  label: ReactNode;
  buttonClassName: string;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((was) => !was)}
        className={buttonClassName}
      >
        {label}
      </button>
      <div
        id={panel}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as Element).closest("a")) setOpen(false);
        }}
        className={`absolute top-full z-50 mt-2 w-64 rounded-lg border border-charcoal/10 bg-parchment p-2 shadow-lg ${
          align === "start" ? "left-0" : "right-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
