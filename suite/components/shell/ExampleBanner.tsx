"use client";

import { useState } from "react";
import { ArrowRight, Compass } from "lucide-react";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { isExampleWedding, startYourOwnWedding } from "@/lib/tour/exampleWedding";

/**
 * While the example is open: say so, and offer the way out.
 *
 * Without it, someone who looked around had no way back to an empty wedding
 * short of clearing the browser — and could easily mistake Alex and Sam's
 * plans for the place their own were meant to go.
 */
export function ExampleBanner() {
  const raw = useKnotworkStore((s) => s.raw);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!isExampleWedding(raw)) return null;

  async function start() {
    setBusy(true);
    setProblem(null);
    try {
      await startYourOwnWedding();
    } catch (cause) {
      // The copy is kept before anything is replaced, so a failure here has
      // left the example exactly as it was — say why, rather than nothing.
      setProblem(`The example could not be kept, so it is still here. ${cause instanceof Error ? cause.message : ""}`.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Example wedding"
      className="mb-8 flex flex-col flex-wrap gap-3 rounded-lg border border-gold/50 bg-gold/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2.5 text-sm text-charcoal">
        <Compass size={17} className="mt-0.5 shrink-0 text-gold" aria-hidden />
        <span>
          You&rsquo;re exploring the example wedding. Change anything you like — when you&rsquo;re
          ready, start your own. The example is kept in Data.
        </span>
      </p>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-gold bg-gold/15 px-4 py-2 text-sm font-medium text-charcoal transition hover:bg-gold/25 disabled:opacity-50"
      >
        Start your own wedding <ArrowRight size={15} aria-hidden />
      </button>
      {problem && (
        <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal sm:basis-full">
          {problem}
        </p>
      )}
    </section>
  );
}
