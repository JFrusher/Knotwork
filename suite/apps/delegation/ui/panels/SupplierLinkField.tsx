"use client";

import { useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/accounts/browserClient";
import { localDay, longDate } from "@/lib/dates";
import { changedSinceConfirmed, supplierUrl, useSupplierLinks } from "@/lib/suppliers/links";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { useConfirm } from "@/components/ui/Confirm";
import { Button } from "@/components/ui/fields";
import styles from "./CrewPanel.module.css";

const dayOf = (at: string) => longDate(localDay(new Date(at)));

/**
 * One supplier's link to their own call sheet — their arrival, their people,
 * their jobs, and nothing about the guests — with a button on it that tells
 * you they have it. Once made it keeps itself current (`SupplierLinkKeeper`).
 */
export function SupplierLinkField({ teamId, name }: { teamId: string; name: string }) {
  const weddingId = useKnotworkStore((s) => s.weddingId);
  const link = useSupplierLinks((s) => s.links?.find((entry) => entry.teamId === teamId));
  const loaded = useSupplierLinks((s) => s.links !== undefined);
  const publish = useSupplierLinks((s) => s.publish);
  const takeDown = useSupplierLinks((s) => s.takeDown);
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // No accounts on this deployment, so nowhere for a link to live.
  if (!browserClient()) return null;

  if (weddingId === null) {
    return (
      <p className={styles.linkNote}>
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        to send {name} a link to their own call sheet.
      </p>
    );
  }
  if (!loaded) return null;

  // The store holds one problem for every supplier; this one shows only its own.
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      setProblem(useSupplierLinks.getState().problem);
    } finally {
      setBusy(false);
    }
  };

  const url = link ? supplierUrl(link, window.location.origin) : "";

  return (
    <div className={styles.link}>
      {link === undefined ? (
        <Button onClick={() => void run(() => publish(teamId))} disabled={busy}>
          Make {name} a link
        </Button>
      ) : (
        <>
          <div className={styles.linkRow}>
            <input
              readOnly
              value={url}
              aria-label={`${name}'s link`}
              className={styles.linkUrl}
              onFocus={(event) => event.target.select()}
            />
            <Button
              onClick={() =>
                void navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p role="status" className={styles.linkNote}>
            {link.confirmedAt === null
              ? "Not confirmed through it yet."
              : changedSinceConfirmed(link)
                ? `Confirmed ${dayOf(link.confirmedAt)} — their sheet has changed since.`
                : `Confirmed ${dayOf(link.confirmedAt)}.`}{" "}
            It updates itself as their jobs change.
          </p>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() =>
              void confirm({
                title: `Take ${name}'s link down?`,
                body: "Whoever has it sees “This link is not live” instead. Making another gives them a new link.",
                action: "Take it down",
                tone: "danger",
              }).then((yes) => (yes ? run(() => takeDown(teamId)) : undefined))
            }
          >
            Take it down
          </Button>
        </>
      )}
      {problem ? (
        <p role="alert" className={styles.linkProblem}>
          {problem}
        </p>
      ) : null}
    </div>
  );
}
