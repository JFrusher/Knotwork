"use client";

import { useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/accounts/browserClient";
import { helperUrl, useHelperLinks } from "@/lib/helpers/links";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { useConfirm } from "@/components/ui/Confirm";
import { Button } from "@/components/ui/fields";
import styles from "./CrewPanel.module.css";

/**
 * One helper's link to their own sheet for the day — the running order, their
 * jobs and their team's, the boxes, the shots, the crew's numbers, and no
 * dietary needs or guests' details. Once made it keeps itself current
 * (`HelperLinkKeeper`), and stops working the day after the wedding.
 */
export function HelperLinkField({ personId, name }: { personId: string; name: string }) {
  const weddingId = useKnotworkStore((s) => s.weddingId);
  const link = useHelperLinks((s) => s.links?.find((entry) => entry.personId === personId));
  const loaded = useHelperLinks((s) => s.links !== undefined);
  const publish = useHelperLinks((s) => s.publish);
  const takeDown = useHelperLinks((s) => s.takeDown);
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
        to send {name} a link to their own sheet for the day.
      </p>
    );
  }
  if (!loaded) return null;

  // The store holds one problem for every helper; this one shows only its own.
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      setProblem(useHelperLinks.getState().problem);
    } finally {
      setBusy(false);
    }
  };

  const url = link ? helperUrl(link, window.location.origin) : "";

  return (
    <div className={styles.link}>
      {link === undefined ? (
        <Button onClick={() => void run(() => publish(personId))} disabled={busy}>
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
              onClick={async () => {
                setProblem(null);
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopied(false);
                  setProblem("The link could not be copied. Select the link and copy it manually.");
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className={styles.linkNote}>It updates itself as the day changes, and stops working the day after the wedding.</p>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() =>
              void confirm({
                title: `Take ${name}'s link down?`,
                body: "Whoever opens it next sees “This link is not live”. A copy already open on their phone stays there. Making another gives them a new link.",
                action: "Take it down",
                tone: "danger",
              }).then((yes) => (yes ? run(() => takeDown(personId)) : undefined))
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
