"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOOLS } from "@/lib/tools";

/**
 * The narrowest screen the tools are built for: a laptop, a desktop, or a
 * tablet turned on its side.
 */
const MIN_WIDTH_PX = 1024;
const WIDE = `(min-width: ${MIN_WIDTH_PX}px)`;

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const isWide = () => window.matchMedia(WIDE).matches;
// A server has no screen. Prerendered as wide, because the gate is the
// exception; the client corrects it on its first render.
const isWideOnServer = () => true;

/** Whether this screen is wide enough for the tools marked `wide`. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, isWide, isWideOnServer);
}

/**
 * For a tool whose detail sits below its list on a phone: each time `key`
 * changes to something, the page scrolls the element behind the returned ref
 * to just under the header (sticky, and as tall as its wrapped tabs there).
 * Does nothing on a wide screen, where the detail is beside the list.
 */
export function useRevealOnPhone<T extends HTMLElement>(key: string | null) {
  const wide = useWideScreen();
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!key || wide || !ref.current) return;
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    window.scrollTo({ top: ref.current.getBoundingClientRect().top + window.scrollY - header });
  }, [key, wide]);
  return ref;
}

/**
 * One gate in front of the wide tools, rather than a copy inside each.
 *
 * Three tools carried their own, copied from one another: Delegation's told a
 * tablet user to go and open "Cadence", and Stationery named "Plaque" — names
 * nobody using Knotwork has ever seen. The name now comes from the same list
 * the tabs are drawn from, so it cannot disagree with the tab above it.
 *
 * Outside the tool rather than inside it, so a gated tool never mounts: its
 * store, its autosave and its reads of the wedding do not run behind a
 * message saying it is not there.
 */
export function LandscapeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide = useWideScreen();

  const tool = TOOLS.find((candidate) => candidate.href === pathname);
  if (!tool) throw new Error(`LandscapeGate wraps the tools only, not ${pathname}.`);
  if (!tool.wide) throw new Error(`LandscapeGate wraps ${pathname}, which lib/tools.ts does not mark wide.`);
  if (wide) {
    return (
      <>
        {/* Every page gets a first-level heading. The tool's name is already on
            screen as the current tab, so this one is for screen readers. */}
        <h1 className="sr-only">{tool.name}</h1>
        {children}
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 px-6 py-20">
      <h1 className="text-2xl">{tool.name} needs a wider screen</h1>
      <p>It is built for a laptop or a desktop, or a tablet turned on its side.</p>
      <p>
        <Link href="/" className="text-charcoal underline underline-offset-4">
          Back to the overview
        </Link>
      </p>
    </div>
  );
}
