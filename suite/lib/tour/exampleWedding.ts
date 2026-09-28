"use client";

import type { Confirm } from "@/components/ui/Confirm";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";

/**
 * The example wedding, and the guard in front of it.
 *
 * Replacing somebody's real work with a demo is the worst thing this feature
 * could do, so a non-empty wedding is never overwritten without being told
 * exactly what is about to go and being offered a backup first.
 */

/** Nothing worth losing: no guests and no blocks. */
export function isWeddingEmpty(): boolean {
  const { doc } = useTrousseauStore.getState();
  return Object.keys(doc.guests).length === 0 && (doc.day?.blocks.length ?? 0) === 0;
}

export async function loadExampleWedding(confirm: Confirm): Promise<"loaded" | "cancelled"> {
  if (!isWeddingEmpty()) {
    const { doc } = useTrousseauStore.getState();
    const guests = Object.keys(doc.guests).length;
    const blocks = doc.day?.blocks.length ?? 0;
    const confirmed = await confirm({
      title: "Replace this wedding with the example?",
      body: `This replaces the wedding in this browser — ${guests} guests and ${blocks} blocks of the day — with the example one. Export a backup first from Data if you want to keep it.`,
      action: "Replace it",
      tone: "danger",
    });
    if (!confirmed) return "cancelled";
  }

  const response = await fetch("/fixtures/example-wedding.trousseau.json");
  if (!response.ok) throw new Error("The example wedding could not be loaded.");
  const document: unknown = await response.json();

  // `silent` keeps it out of the undo stack: the user did not make this change
  // by editing, and offering to undo it would offer to restore what they were
  // just warned they were replacing.
  useTrousseauStore.getState().replaceDocument(document, { silent: true });
  return "loaded";
}
