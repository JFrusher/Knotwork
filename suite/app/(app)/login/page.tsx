"use client";

import { type JSX, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { enabledProviders, type Provider } from "@/lib/accounts/providers";
import { Button, TextField } from "@/components/ui/controls";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" fill="currentColor">
      <path d="M14.94 13.6c-.3.68-.44.98-.82 1.58-.54.84-1.3 1.88-2.24 1.89-.84.01-1.06-.55-2.2-.54-1.14 0-1.38.55-2.22.54-.94-.01-1.66-.95-2.2-1.78-1.5-2.33-1.66-5.06-.73-6.51.66-1.03 1.7-1.63 2.68-1.63 1 0 1.62.55 2.45.55.8 0 1.29-.55 2.44-.55.87 0 1.8.48 2.46 1.3-2.16 1.18-1.81 4.27.38 5.15zM11.22 5.42c.42-.54.74-1.3.62-2.08-.68.05-1.48.48-1.95 1.05-.42.52-.77 1.28-.64 2.03.75.02 1.52-.43 1.97-1z" />
    </svg>
  );
}

const PROVIDERS: { id: Provider; label: string; mark: () => JSX.Element }[] = [
  { id: "google", label: "Continue with Google", mark: GoogleMark },
  { id: "apple", label: "Continue with Apple", mark: AppleMark },
];

function loginDescription(next: string | null) {
  if (next?.startsWith("/invite/")) {
    return "Use the address your invite was sent to. We’ll email you a six-digit code that brings you back to it.";
  }
  if (next === "/weddings") {
    return "Sign in to see your clients’ weddings. We’ll email you a six-digit code — no password to remember.";
  }
  return "We’ll email you a six-digit code — no password to remember.";
}

/** `/auth/callback`, carrying where the person was going. */
function callbackUrl(next: string | null): URL {
  const callback = new URL("/auth/callback", window.location.origin);
  if (next) callback.searchParams.set("next", next);
  return callback;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Which provider is mid-redirect. The page is about to be left, so this only
  // has to hold the buttons still until the browser goes.
  const [leavingFor, setLeavingFor] = useState<Provider | null>(null);
  useEffect(() => {
    // Back from the provider restores this page from the back/forward cache,
    // buttons still held — release them.
    const release = (event: PageTransitionEvent) => event.persisted && setLeavingFor(null);
    window.addEventListener("pageshow", release);
    return () => window.removeEventListener("pageshow", release);
  }, []);

  const client = browserClient();
  // Only the providers this project has switched on — none until we know.
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    if (!client) return;
    enabledProviders()
      .then(setProviders)
      .catch((cause: unknown) => {
        // The email code still works; the buttons just are not offered.
        console.warn("[login] could not read which sign-in providers are on", cause);
      });
  }, [client]);
  const offered = PROVIDERS.filter(({ id }) => providers.includes(id));
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

  async function continueWith(provider: Provider) {
    setError(null);
    if (!client) {
      setError("Accounts are not set up on this deployment.");
      return;
    }
    // Back through /auth/callback, which exchanges the PKCE code server-side
    // and carries `next` on. Built from the current origin, so the same code
    // serves localhost and production — each must be on Supabase's
    // redirect allowlist.
    const callback = callbackUrl(next);
    setLeavingFor(provider);
    const { error: oauthError } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callback.toString(),
        // Apple only sends the name on the very first sign-in, and only if asked.
        ...(provider === "apple" ? { scopes: "name email" } : {}),
      },
    });
    if (oauthError) {
      setLeavingFor(null);
      setError(oauthError.message);
    }
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
    // Through the callback, like every other sign-in: it starts a first-time
    // couple's wedding, and knows where `next` may and may not lead.
    window.location.assign(callbackUrl(next).toString());
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
      <div className="mt-6">
        {next?.startsWith("/invite/") && (
          // An invite opens only for the address it was sent to, and Apple's
          // Hide My Email signs in with a relay address that never matches.
          <p className="mb-4 text-sm text-slate">
            Sign in with the address your invite was sent to.
            {providers.includes("apple") && (
              <>
                {" "}With Apple, choose <span className="font-medium text-charcoal">Share My Email</span>.
              </>
            )}
          </p>
        )}
        {offered.length > 0 && (
          <>
            <div className="space-y-3">
              {offered.map(({ id, label, mark: Mark }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void continueWith(id)}
                  disabled={busy || leavingFor !== null}
                  className="flex w-full items-center justify-center gap-2.5 rounded border border-charcoal/15 bg-parchment px-3 py-2.5 text-sm font-medium text-charcoal transition hover:border-gold disabled:pointer-events-none disabled:opacity-40"
                >
                  <Mark />
                  {leavingFor === id ? "Redirecting..." : label}
                </button>
              ))}
            </div>
            <div className="my-6 flex items-center gap-3 text-xs tracking-[0.14em] text-slate uppercase" role="separator">
              <span className="h-px flex-1 bg-charcoal/15" />
              or
              <span className="h-px flex-1 bg-charcoal/15" />
            </div>
          </>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-slate">{description}</p>
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Button onClick={() => void sendCode()} tone="primary" icon={Mail} disabled={busy || leavingFor !== null || !email}>
            {busy ? "Sending..." : "Send me a code"}
          </Button>
          {error && (
            <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-charcoal">
              {error}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Knotwork</p>
      <h1 className="mt-3 font-display text-3xl text-charcoal">Sign in</h1>
      {content}
    </div>
  );
}
