"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { Button, TextField } from "@/components/ui/controls";

function loginDescription(next: string | null) {
  if (next?.startsWith("/invite/")) {
    return "Use the address your invite was sent to. We’ll email you a six-digit code that brings you back to it.";
  }
  if (next === "/weddings") {
    return "Sign in to see your clients’ weddings. We’ll email you a six-digit code — no password to remember.";
  }
  return "We’ll email you a six-digit code — no password to remember.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const client = browserClient();
  // Where the person was going — an invite, usually. Carried through the
  // link, or it lands on /account, which for an invitee is the wrong door.
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get("next"));
  }, []);

  useEffect(() => {
    if (resendCooldown === 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function sendCode() {
    setError(null);
    if (!client) {
      setError("Accounts are not set up on this deployment.");
      return;
    }
    setBusy(true);
    const { error: sendError } = await client.auth.signInWithOtp({ email });
    setBusy(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setSent(true);
    setCode("");
    setResendCooldown(30);
  }

  async function verifyCode() {
    setError(null);
    if (!client) {
      setError("Accounts are not set up on this deployment.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setBusy(true);
    const { error: verifyError } = await client.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    window.location.assign(next ?? "/weddings");
  }

  function useDifferentEmail() {
    setSent(false);
    setCode("");
    setError(null);
    setResendCooldown(0);
  }

  const description = loginDescription(next);

  let content;
  if (!client) {
    content = (
      <p className="mt-6 text-slate">
        Accounts are not set up on this deployment. Everything still works without one.
      </p>
    );
  } else if (sent) {
    content = (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-slate">
          Enter the six-digit code we sent to <span className="font-medium text-charcoal">{email}</span>.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1 block text-xs text-slate">Verification code</span>
            <input
              aria-label="Verification code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded border border-charcoal/15 bg-parchment px-2 py-2 text-center text-lg tracking-[0.35em] text-charcoal focus:border-gold"
            />
          </label>
          <Button onClick={() => void verifyCode()} tone="primary" disabled={busy || code.length !== 6}>
            {busy ? "Verifying..." : "Verify Code"}
          </Button>
          {error && (
            <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
              {error}
            </p>
          )}
        </form>
        <div className="flex items-center gap-3 text-sm">
          <Button onClick={() => void sendCode()} disabled={busy || resendCooldown > 0}>
            {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Code"}
          </Button>
          <button type="button" onClick={useDifferentEmail} className="text-slate underline hover:text-charcoal">
            Use a different email
          </button>
        </div>
      </div>
    );
  } else {
    content = (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendCode();
        }}
        className="mt-6 space-y-4"
      >
        <p className="text-sm text-slate">{description}</p>
        <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <Button onClick={() => void sendCode()} tone="primary" icon={Mail} disabled={busy || !email}>
          {busy ? "Sending..." : "Send me a code"}
        </Button>
        {error && (
          <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Trousseau</p>
      <h1 className="mt-3 font-display text-3xl text-charcoal">Sign in</h1>
      {content}
    </div>
  );
}
