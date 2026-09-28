"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/accounts/browserClient";
import { SignInFailed } from "@/components/shell/SignInFailed";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [status, setStatus] = useState<"checking" | "signed-out" | "accepting" | "done" | "error">(
    "checking",
  );
  const [message, setMessage] = useState<string | null>(null);
  const client = browserClient();

  useEffect(() => {
    if (!client) {
      setStatus("error");
      setMessage("Accounts are not set up on this deployment.");
      return;
    }
    client
      .auth.getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          setStatus("signed-out");
          return;
        }
        setStatus("accepting");
        const response = await fetch(`/api/accounts/invite/${token}`, { method: "POST" });
        // An unhandled server error comes back as HTML, and parsing that would
        // reject inside this callback — leaving the page stuck on "One moment…"
        // with nothing on screen to explain why.
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.ok) {
          setStatus("done");
          // A full load, not a client-side one: sync starts as the app loads,
          // and this is the moment it has a wedding to sync with. It is also
          // where a wedding already on this device is asked about rather than
          // replaced.
          window.location.assign("/");
        } else {
          setStatus("error");
          setMessage(body?.error ?? "That invite could not be accepted.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [client, token]);

  return (
    <div className="mx-auto max-w-md px-6 py-12 text-center sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Trousseau</p>
      <h1 className="mt-3 font-display text-3xl text-charcoal">You&rsquo;re invited</h1>

      <div className="mt-6">
        {(status === "checking" || status === "accepting") && (
          <p className="text-slate">One moment…</p>
        )}

        {status === "signed-out" && (
          <div className="space-y-4">
            <SignInFailed />
            <p className="text-slate">Sign in with the email this invite was sent to. The link we send brings you back here.</p>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="inline-flex min-h-11 items-center rounded border border-gold bg-gold/15 px-4 py-2 text-sm text-charcoal transition hover:bg-gold/25"
            >
              Sign in
            </Link>
          </div>
        )}

        {status === "done" && (
          <p role="status" className="rounded border border-ok/40 bg-ok-soft px-3 py-2 text-sm text-charcoal">
            You&rsquo;re in — opening the wedding…
          </p>
        )}

        {status === "error" && (
          <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
