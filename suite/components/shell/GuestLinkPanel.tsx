"use client";

import { useState } from "react";
import Link from "next/link";
import { Check as CheckIcon, Copy, Link2, Unlink } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { linkUrl, useGuestLink } from "@/lib/share/guestLink";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { Button, Check, Panel } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/Confirm";

/**
 * The guest link: names and table numbers, for guests to find their seat.
 *
 * On the account, like the wedding: no second passphrase, and any of the
 * couple or their planner can publish it. Once published it keeps itself
 * current (`GuestLinkKeeper`), because a link that sends a guest to the table
 * they used to be at is worse than none.
 */
export function GuestLinkPanel() {
  const weddingId = useKnotworkStore((s) => s.weddingId);
  const link = useGuestLink((s) => s.link);
  const problem = useGuestLink((s) => s.problem);
  const publish = useGuestLink((s) => s.publish);
  const takeDown = useGuestLink((s) => s.takeDown);
  const confirm = useConfirm();
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // No accounts on this deployment, so nowhere for a link to live.
  if (!browserClient()) return null;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const url = link ? linkUrl(link, window.location.origin) : null;

  return (
    <Panel title="A link for the guests">
      <p className="text-xs text-slate">
        Names and table numbers only. No email addresses, no phone numbers, no dietary requirements,
        no notes — and nobody who declined. The key that reads it sits in the link after the{" "}
        <span className="text-charcoal">#</span>, which browsers never send to a server.
      </p>

      {weddingId === null ? (
        <p className="mt-2 text-sm text-slate">
          It lives on your account, so it can keep itself up to date as seats change.{" "}
          <Link href="/login" className="text-charcoal underline decoration-gold">
            Sign in
          </Link>{" "}
          to publish one.
        </p>
      ) : link === undefined ? (
        <p className="mt-2 text-sm text-slate">Checking for a link…</p>
      ) : link === null ? (
        <div className="mt-2 space-y-2">
          <Check label="Show the room, not just the search" checked={showPlan} onChange={setShowPlan} />
          <Button icon={Link2} tone="primary" disabled={busy} onClick={() => void run(() => publish(showPlan))}>
            Publish a link
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input
              readOnly
              value={url ?? ""}
              aria-label="The guest link"
              className="min-w-0 flex-1 rounded border border-charcoal/15 bg-parchment px-2 py-1.5 text-xs text-charcoal"
              onFocus={(event) => event.target.select()}
            />
            <Button
              icon={copied ? CheckIcon : Copy}
              onClick={() =>
                void navigator.clipboard.writeText(url ?? "").then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p role="status" className="text-xs text-slate">
            Updated {new Date(link.publishedAt).toLocaleString()}. It updates itself as seats change.
          </p>
          <Check
            label="Show the room, not just the search"
            checked={link.showPlan}
            onChange={(next) => void run(() => publish(next))}
          />
          <Button
            icon={Unlink}
            tone="danger"
            disabled={busy}
            onClick={() =>
              void confirm({
                title: "Take the guest link down?",
                body: "Everyone who has it sees “This link is not live” instead. Publishing again makes a new link.",
                action: "Take it down",
                tone: "danger",
              }).then((yes) => (yes ? run(takeDown) : undefined))
            }
          >
            Take it down
          </Button>
        </div>
      )}

      {problem ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </Panel>
  );
}
