"use client";

import { useState } from "react";
import { Cloud, Laptop } from "lucide-react";
import { describe, summarise } from "@/lib/model/content";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { Button, Panel } from "@/components/ui/controls";

/**
 * This device and the account hold two different weddings: which one stays.
 *
 * Asked only when both have something in them and the device has never
 * synced with this account's wedding — first sign-in on a device that was
 * already in use, or accepting an invite with a wedding of your own started.
 * Every other meeting of the two settles itself without losing anything.
 */
export function WeddingChoice() {
  const choice = useTrousseauStore((s) => s.cloudChoice);
  const raw = useTrousseauStore((s) => s.raw);
  const chooseWedding = useTrousseauStore((s) => s.chooseWedding);
  const cloudError = useTrousseauStore((s) => s.cloudError);
  const [busy, setBusy] = useState(false);
  if (!choice) return null;

  async function choose(keep: "device" | "account") {
    setBusy(true);
    try {
      await chooseWedding(keep);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Two different weddings">
      <p className="text-sm text-slate">
        This device and your account each hold a wedding, and they are not the same one. Choose
        which to keep. The other is kept as a copy on this device, and you can put it back from
        here.
      </p>
      <dl className="my-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="flex items-center gap-2 text-slate">
          <Laptop size={15} aria-hidden /> This device
        </dt>
        <dd className="text-charcoal">{describe(summarise(raw))}</dd>
        <dt className="flex items-center gap-2 text-slate">
          <Cloud size={15} aria-hidden /> Your account
        </dt>
        <dd className="text-charcoal">{describe(summarise(choice.document))}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button tone="primary" icon={Cloud} disabled={busy} onClick={() => void choose("account")}>
          Use your account’s
        </Button>
        <Button icon={Laptop} disabled={busy} onClick={() => void choose("device")}>
          Keep this device’s
        </Button>
      </div>
      <p className="mt-3 text-xs text-slate">
        Keeping this device’s replaces the wedding on your account — for anyone else on it too.
      </p>
      {cloudError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {cloudError}
        </p>
      ) : null}
    </Panel>
  );
}
