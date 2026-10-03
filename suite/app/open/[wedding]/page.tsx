"use client";

import { use, useEffect, useState } from "react";
import { openWedding } from "@/lib/store/openWedding";

/**
 * Opening another of the account's weddings on this device.
 *
 * Outside the app's layout on purpose, like `/seat`: no store and no tool is
 * loaded here, so nothing can write the wedding being left over the one being
 * opened. The page it came from handed over its last edit as it unloaded, the
 * same as any reload; this one swaps what is stored, then loads the app.
 */
export default function OpenWeddingPage({ params }: { params: Promise<{ wedding: string }> }) {
  const { wedding } = use(params);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    openWedding(wedding)
      .then(() => window.location.replace("/"))
      .catch((cause: unknown) => setProblem(cause instanceof Error ? cause.message : String(cause)));
  }, [wedding]);

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Knotwork</p>
      {problem ? (
        <p role="alert" className="mt-6 rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
          That wedding could not be opened: {problem}
        </p>
      ) : (
        <p role="status" className="mt-6 text-slate">
          Opening the wedding…
        </p>
      )}
    </main>
  );
}
