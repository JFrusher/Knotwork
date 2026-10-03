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

/** The top-level key that marks a document as the example. */
const EXAMPLE_MARK = "exampleWedding";

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
  const document = (await response.json()) as Record<string, unknown>;

  // `silent` keeps it out of the undo stack: the user did not make this change
  // by editing, and offering to undo it would offer to restore what they were
  // just warned they were replacing.
  //
  // Marked, so the front page can offer the way back out: someone looking
  // around must be able to start their own wedding without knowing to clear
  // the browser. Edits keep the mark (a write merges into the raw document);
  // anything that replaces the whole document drops it.
  useKnotworkStore.getState().replaceDocument({ ...document, [EXAMPLE_MARK]: true }, { silent: true });
  return "loaded";
}

/** Whether this is (an edited copy of) the example wedding. */
export function isExampleWedding(raw: Record<string, unknown>): boolean {
  return raw[EXAMPLE_MARK] === true;
}

/**
 * Leave the example for an empty wedding of your own.
 *
 * Undoable, and the example — with anything changed in it — is kept on this
 * device as well, so trying it out first never costs anything.
 */
export async function startYourOwnWedding(): Promise<void> {
  const { raw, replaceDocument } = useKnotworkStore.getState();
  await useCopies.getState().keep(raw, "The example wedding, kept when you started your own.");
  replaceDocument({}, { label: "starting your own wedding" });
}
