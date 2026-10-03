"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { entries, search, type Entry } from "@/lib/palette/search";
import { Dialog } from "@/components/ui/Dialog";

/** Whether the palette is open: from its header button, or Ctrl/⌘ K anywhere. */
export const usePalette = create<{ open: boolean; show: () => void; hide: () => void }>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

/**
 * Go to anything by name: a page, a guest, a table, a block of the day, a job
 * or a task. A combobox over a list of what matches, worked from the keyboard
 * — arrows to move, Enter to go — or with a pointer.
 */
export function CommandPalette() {
  const open = usePalette((s) => s.open);
  const hide = usePalette((s) => s.hide);
  return (
    <Dialog open={open} onClose={hide} labelledBy="palette-title" width="max-w-xl">
      <Finder onGo={hide} />
    </Dialog>
  );
}

function Finder({ onGo }: { onGo: () => void }) {
  const doc = useKnotworkStore((s) => s.doc);
  const router = useRouter();
  const all = useMemo(() => entries(doc), [doc]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const found = useMemo(() => search(all, query), [all, query]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    onGo();
    router.push(entry.href);
  };

  return (
    <div className="p-4">
      <h2 id="palette-title" className="sr-only">
        Find anything
      </h2>
      <input
        role="combobox"
        aria-expanded={found.length > 0}
        aria-controls="palette-results"
        aria-activedescendant={found[active] ? `palette-${active}` : undefined}
        aria-label="Find a guest, table, block, job or page"
        autoFocus
        value={query}
        placeholder="A guest, a table, a block of the day, a job…"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, found.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            go(found[active]);
          }
        }}
        className="w-full rounded border border-charcoal/15 bg-parchment px-3 py-2 text-base text-charcoal focus:border-gold"
      />
      {found.length === 0 ? (
        <p className="px-1 pt-4 text-sm text-slate">Nothing in the wedding is called that.</p>
      ) : (
        <ul id="palette-results" role="listbox" aria-label="Found" className="mt-3 max-h-96 overflow-y-auto">
          {found.map((entry, index) => (
            <li
              key={`${entry.kind}-${entry.href}-${entry.name}`}
              id={`palette-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(entry)}
              className={`flex cursor-pointer items-baseline gap-3 rounded px-3 py-2 ${index === active ? "bg-stone" : ""}`}
            >
              <span className="w-12 shrink-0 text-xs text-slate">{entry.kind}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-charcoal">{entry.name}</span>
              {entry.detail ? <span className="shrink-0 text-xs text-slate">{entry.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
