"use client";

import { useEffect } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { describe, hasContent, summarise } from "@/lib/model/content";
import { useCopies, type KeptCopy } from "@/lib/store/copies";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { Button, Panel } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/Confirm";

/** Weddings this device kept because something replaced them — see `copies`. */
export function KeptCopies({ onDone }: { onDone: (message: string) => void }) {
  const copies = useCopies((s) => s.copies);
  const load = useCopies((s) => s.load);
  const confirm = useConfirm();
  useEffect(() => {
    void load();
  }, [load]);
  if (copies.length === 0) return null;

  async function putBack(copy: KeptCopy) {
    const { raw, cloudStatus, replaceDocument } = useKnotworkStore.getState();
    const shared = cloudStatus !== "disabled";
    const yes = await confirm({
      title: "Put this wedding back?",
      body: `${describe(summarise(copy.document))} replaces the wedding open now${
        shared ? " — on your account too, for anyone else on it" : ""
      }. The one open now is kept as a copy here.`,
      action: "Put it back",
    });
    if (!yes) return;
    // A swap: what is open now takes the copy's place in the list.
    if (hasContent(summarise(raw))) await useCopies.getState().keep(raw, "Replaced when a kept copy was put back.");
    replaceDocument(copy.document, { label: "put back a kept copy" });
    await useCopies.getState().remove(copy.id);
    onDone("The kept copy is back.");
  }

  async function remove(copy: KeptCopy) {
    const yes = await confirm({
      title: "Delete this copy?",
      body: `${describe(summarise(copy.document))} is removed from this device for good.`,
      action: "Delete it",
      tone: "danger",
    });
    if (yes) await useCopies.getState().remove(copy.id);
  }

  return (
    <Panel title="Copies kept on this device">
      <ul className="space-y-3">
        {copies.map((copy) => (
          <li key={copy.id} className="rounded border border-charcoal/10 p-3">
            <p className="text-sm text-charcoal">{describe(summarise(copy.document))}</p>
            <p className="mt-1 text-xs text-slate">
              {copy.why} Kept {new Date(copy.keptAt).toLocaleString()}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button icon={RotateCcw} onClick={() => void putBack(copy)}>
                Put it back
              </Button>
              <Button icon={Trash2} tone="danger" onClick={() => void remove(copy)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
