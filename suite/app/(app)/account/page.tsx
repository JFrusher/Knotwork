"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, LogOut, Trash2, UserPlus } from "lucide-react";
import { browserClient } from "@/lib/accounts/browserClient";
import { Button } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/Confirm";
import { removeWeddingFromDevice } from "@/lib/store/removeFromDevice";
import { SignInFailed } from "@/components/shell/SignInFailed";
import { WeddingPeople } from "@/components/shell/WeddingPeople";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import type { WeddingListing } from "@/lib/accounts/handlers";

type AccountState = { signedIn: false } | { signedIn: true; me: string; weddings: WeddingListing[] };

interface Notice {
  text: string;
  tone: "ok" | "error";
}

/**
 * A failed request doesn't always carry JSON — an unhandled server error comes
 * back as HTML, and `response.json()` on that rejects. Swallowing it here
 * keeps every caller's `await` on the happy path, with `null` standing for
 * "nothing useful came back".
 */
async function readJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

export default function AccountPage() {
  const [state, setState] = useState<AccountState | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const client = browserClient();
  const confirm = useConfirm();
  // The wedding open on this device — the one "who has access" is about.
  const open = useKnotworkStore((s) => s.weddingId);
  const say = useCallback((text: string, tone: "ok" | "error") => setNotice({ text, tone }), []);

  useEffect(() => {
    if (!client) {
      setState({ signedIn: false });
      return;
    }
    client
      .auth.getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          setState({ signedIn: false });
          return;
        }
        const response = await fetch("/api/accounts/weddings");
        const body = await readJson<{ weddings?: WeddingListing[] }>(response);
        setState({ signedIn: true, me: data.user.id, weddings: (response.ok && body?.weddings) || [] });
      })
      .catch(() => {
        // Never leave the page on "Loading…" because a request threw.
        setState({ signedIn: false });
        setNotice({ text: "Could not load your account. Please try again.", tone: "error" });
      });
  }, [client]);

  async function createWedding() {
    const response = await fetch("/api/accounts/weddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "partner" }),
    });
    const body = await readJson<{ weddingId?: string; error?: string }>(response);
    if (!response.ok) {
      setNotice({ text: body?.error ?? "Could not create a wedding.", tone: "error" });
      return;
    }
    // A full load: sync starts as the app loads, and only now is there a
    // wedding for it to start with. Without it nothing reached the account
    // until the next visit.
    window.location.reload();
  }

  const [signingOut, setSigningOut] = useState(false);

  async function signOut(remove: boolean) {
    await client?.auth.signOut();
    // Shared computers exist. Kept, the wedding stays on this device and
    // picks up where it left off at the next sign-in.
    if (remove) await removeWeddingFromDevice();
    window.location.href = "/login";
  }

  async function deleteAccount() {
    const confirmed = await confirm({
      title: "Delete your account?",
      body: "You leave every wedding you are on. Each one stays with anyone else on it; any you are the last one on is deleted. This cannot be undone.",
      action: "Delete my account",
      tone: "danger",
    });
    if (!confirmed) return;
    const response = await fetch("/api/accounts/delete", { method: "POST" });
    const body = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setNotice({ text: body?.error ?? "Could not delete your account.", tone: "error" });
      return;
    }
    await client?.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Knotwork</p>
      <h1 className="mt-3 font-display text-3xl text-charcoal">Your account</h1>

      {!client ? (
        <p className="mt-6 text-slate">
          Accounts are not set up on this deployment. Everything still works without one.
        </p>
      ) : !state ? (
        <p className="mt-6 text-slate">Loading…</p>
      ) : !state.signedIn ? (
        <div className="mt-6 space-y-4">
          <SignInFailed />
          <p className="text-slate">Sign in to manage your wedding account.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {notice && (
            <p
              className={`rounded border px-3 py-2 text-sm text-charcoal ${
                notice.tone === "ok" ? "border-ok/40 bg-ok-soft" : "border-danger/40 bg-danger-soft"
              }`}
            >
              {notice.text}
            </p>
          )}

          {state.weddings.length === 0 ? (
            <section className="space-y-3">
              <p className="text-sm text-slate">
                You&rsquo;re not on a wedding yet. If your partner invited you, open the link in
                their email instead — one of the couple is on one wedding at a time, so starting
                your own now means you cannot join theirs.
              </p>
              <Button onClick={() => void createWedding()} icon={UserPlus}>
                Start our wedding
              </Button>
              <p className="text-sm text-slate">
                Planning weddings for clients? <Link href="/weddings" className="underline">Your weddings</Link>
              </p>
            </section>
          ) : (
            <>
              {state.weddings.length > 1 || open === null ? (
                <p className="text-sm text-slate">
                  You are on {state.weddings.length === 1 ? "one wedding" : `${state.weddings.length} weddings`}.{" "}
                  <Link href="/weddings" className="underline">
                    {open === null ? "Open one" : "See them all"}
                  </Link>
                </p>
              ) : null}
              {open !== null ? (
                <>
                  <WeddingPeople weddingId={open} me={state.me} onNotice={say} />
                  <section className="space-y-3 border-t border-charcoal/10 pt-6">
                    <h2 className="text-xs tracking-widest text-slate uppercase">Your data</h2>
                    <p className="text-sm text-slate">
                      Download the wedding open here as one file — guests, seating, the day, the
                      crew and the stationery. It opens in Knotwork anywhere, including your own
                      copy if you ever run one.
                    </p>
                    <Button
                      onClick={() => window.location.assign(`/api/documents/export?wedding=${encodeURIComponent(open)}`)}
                      icon={Download}
                    >
                      Download this wedding
                    </Button>
                  </section>
                </>
              ) : null}
            </>
          )}

          <section className="flex flex-wrap gap-2 border-t border-charcoal/10 pt-6">
            {signingOut ? (
              <div className="w-full space-y-3">
                <p className="text-sm text-slate">
                  Keep the wedding on this device, or remove it? On a computer that isn&rsquo;t
                  yours, remove it — it stays on your account either way.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void signOut(false)} icon={LogOut}>
                    Sign out and keep it here
                  </Button>
                  <Button onClick={() => void signOut(true)} icon={Trash2} tone="danger">
                    Sign out and remove it
                  </Button>
                  <Button onClick={() => setSigningOut(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setSigningOut(true)} icon={LogOut}>
                Sign out
              </Button>
            )}
            <Button onClick={() => void deleteAccount()} tone="danger" icon={Trash2}>
              Delete my account
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
