"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { fortnight } from "@/lib/model/fortnight";
import { hiddenToolIds } from "@/lib/model/toolbox";
import { todayIso } from "@/lib/dates";
import { EYEBROW } from "@/components/ui/eyebrow";

/**
 * The last fortnight, when couples come back to print: what to print, the
 * Binder for the phones, and what is still open that would go to print wrong.
 * Not dismissible — it is the point of these two weeks.
 */
export function FortnightCard() {
  const doc = useKnotworkStore((s) => s.doc);
  const raw = useKnotworkStore((s) => s.raw);
  const status = useKnotworkStore((s) => s.status);
  const card = useMemo(() => fortnight(doc, raw, todayIso()), [doc, raw]);
  if (status !== "ready" || !card) return null;
  const binder = !hiddenToolIds(doc).has("binder");

  return (
    <section aria-labelledby="fortnight-heading" className="mt-10 rounded-lg border-2 border-gold/60 bg-parchment px-5 py-4">
      <h2 id="fortnight-heading" className="text-lg text-charcoal">
        {card.days === 0 ? "The day is here" : `${card.days} ${card.days === 1 ? "day" : "days"} to go`}
      </h2>
      <div className="mt-3 grid gap-6 sm:grid-cols-3">
        <div>
          <h3 className={`text-slate ${EYEBROW}`}>To print</h3>
          <ul className="mt-2 flex flex-col">
            {card.print.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {binder ? (
          <div>
            <h3 className={`text-slate ${EYEBROW}`}>On your phone</h3>
            <p className="mt-2 text-slate">
              The{" "}
              <Link href="/binder" className="underline underline-offset-2 hover:text-charcoal">
                Binder
              </Link>{" "}
              works with no signal. Open it once on each phone while there is signal, so it is kept there.
            </p>
          </div>
        ) : null}
        <div>
          <h3 className={`text-slate ${EYEBROW}`}>Still open</h3>
          {card.open.length === 0 ? (
            <p className="mt-2 text-slate">Nothing that would print wrong.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {card.open.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
                    {item.message}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
