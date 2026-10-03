"use client";

import type { Confirm } from "@/components/ui/Confirm";
import { describe, hasContent, summarise } from "@/lib/model/content";
import { useCopies } from "@/lib/store/copies";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";

/**
 * The example wedding, and the guard in front of it.
 *
 * Replacing somebody's real work with a demo is the worst thing this feature
 * could do, so a wedding with anything in it is never overwritten without
 * being told exactly what is about to go — and a copy of it is kept on this
 * device, to put back from Data.
 */

/** Nothing worth losing — by the same measure signing in uses. */
export function isWeddingEmpty(): boolean {
  return !hasContent(summarise(useKnotworkStore.getState().raw));
}

export async function loadExampleWedding(confirm: Confirm): Promise<"loaded" | "cancelled"> {
  const { raw, cloudStatus } = useKnotworkStore.getState();
  if (!isWeddingEmpty()) {
    // Synced, the example goes to the account too — and to whoever else is on
    // the wedding. The question has to say so.
    const shared = cloudStatus !== "disabled";
    const confirmed = await confirm({
      title: "Replace this wedding with the example?",
      body: `${describe(summarise(raw))} is replaced with the example${
        shared ? " — on your account too, so anyone else on the wedding sees the example instead" : ""
      }. A copy is kept on this device: put it back from Data.`,
      action: "Replace it",
      tone: "danger",
    });
    if (!confirmed) return "cancelled";
    await useCopies.getState().keep(raw, "Replaced by the example wedding.");
  }
  const response = await fetch("/fixtures/example-wedding.knotwork.json");
  if (!response.ok) throw new Error("The example wedding could not be loaded.");
  const document: unknown = await response.json();

  // `silent` keeps it out of the undo stack: the user did not make this change
  // by editing, and offering to undo it would offer to restore what they were
  // just warned they were replacing.
  useKnotworkStore.getState().replaceDocument(document, { silent: true });
  return "loaded";
}
