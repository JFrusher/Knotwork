"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hasContent, summarise } from "@/lib/model/content";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";

/**
 * The front page's first action, until there is a wedding to show: setting
 * one up. Gone as soon as anything is in it — by setup or by hand.
 */
export function SetupPrompt() {
  const status = useKnotworkStore((s) => s.status);
  const raw = useKnotworkStore((s) => s.raw);
  const empty = useMemo(() => !hasContent(summarise(raw)), [raw]);
  if (status !== "ready" || !empty) return null;

  return (
    <section className="mt-8 rounded-lg border border-gold/40 bg-gold/10 p-6">
      <h2 className="font-display text-2xl text-charcoal">Start with the two of you</h2>
      <p className="mt-2 text-slate">
        Your names, then who is coming, then the room — a few minutes, and every part of Knotwork
        has something to work with.
      </p>
      <Link
        href="/setup"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded border border-gold bg-gold/15 px-4 py-2 text-sm text-charcoal transition hover:bg-gold/25"
      >
        Set up your wedding <ArrowRight size={15} aria-hidden />
      </Link>
    </section>
  );
}
