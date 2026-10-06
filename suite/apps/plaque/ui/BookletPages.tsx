"use client";

import styles from "./BookletPages.module.css";

const ROLES = [
  { role: "cover", label: "Cover" },
  { role: "inside", label: "Inside" },
  { role: "back", label: "Back" },
] as const;

/**
 * The booklet's three designs, where a card has its front and back: the
 * cover, the inside page every inside page repeats, and the back. Each opens
 * the first page of its kind; whatever is added goes on the page on screen.
 */
export function BookletPages({ role, count, onOpen }: { role: string; count: number; onOpen: (index: number) => void }) {
  const first = { cover: 0, inside: 1, back: count - 1 } as const;
  return (
    <span className={styles.pages} role="group" aria-label="Which page of the booklet">
      {ROLES.map((entry) => (
        <button key={entry.role} type="button" aria-pressed={role === entry.role} onClick={() => onOpen(first[entry.role])}>
          {entry.label}
        </button>
      ))}
    </span>
  );
}
