"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { Button, TextField } from "@/components/ui/controls";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = browserClient();
  // Where the person was going — an invite, usually. Carried through the
  // link, or it lands on /account, which for an invitee is the wrong door.
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get("next"));
  }, []);

  async function sendLink() {
    setError(null);
    if (!client) {
      setError("Accounts are not set up on this deployment.");
      return;
    }
    setBusy(true);
    // The link has to come back through `/auth/callback`, which exchanges its
    // code for a real session; without a redirect target there is nowhere for
    // that exchange to happen and signing in never takes effect.
    const callback = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error: sendError } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback },
    });
    setBusy(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Trousseau</p>
      <h1 className="mt-3 font-display text-3xl text-charcoal">Sign in</h1>

      {!client ? (
        <p className="mt-6 text-slate">
          Accounts are not set up on this deployment. Everything still works without one.
        </p>
      ) : sent ? (
        <p className="mt-6 rounded border border-ok/40 bg-ok-soft px-3 py-2 text-sm text-charcoal">
          Check <span className="font-medium">{email}</span> for a sign-in link.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendLink();
          }}
          className="mt-6 space-y-4"
        >
          <p className="text-sm text-slate">
            {next?.startsWith("/invite/")
              ? "Use the address your invite was sent to. We’ll email you a link that brings you back to it."
              : next === "/weddings"
                ? "Sign in to see your clients’ weddings. We’ll email you a link — no password to remember."
                : "We’ll email you a link — no password to remember."}
          </p>
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Button onClick={() => void sendLink()} tone="primary" icon={Mail} disabled={busy || !email}>
            {busy ? "Sending…" : "Send me a sign-in link"}
          </Button>
          {error && (
            <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
