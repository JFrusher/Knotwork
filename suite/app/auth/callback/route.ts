import { NextResponse } from "next/server";
import { serverClient } from "@/lib/accounts/serverClient";
import { accountsStore } from "@/lib/accounts/supabaseStore";
import { createWeddingHandler } from "@/lib/accounts/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where every magic link lands — sign-in and partner invites alike.
 *
 * Supabase's link carries a PKCE `code`, not a session: it has to be exchanged
 * here, server-side, so the session cookies are set on the response before any
 * page renders. `next` is where to go once that's done (the invite page, for
 * an invite), so pages downstream can assume a session already exists.
 */
/**
 * A same-site path, or `/account` if `next` isn't one.
 *
 * Parse first, then compare the resolved origin — not a prefix check on the
 * raw string. A prefix regex like `/^\/(?!\/)/` looks like it blocks
 * `//evil.com` but not `/\evil.com`: `new URL()` normalises a backslash to a
 * forward slash for http/https before parsing, so that string resolves to
 * `https://evil.com/` regardless of what the raw text started with. Letting
 * the URL parser do the normalising, then checking *its* output, is the only
 * way `next` can't be turned into an open redirect through a variant a regex
 * didn't anticipate.
 */
export function sameOriginPath(next: string | null, origin: string): string {
  if (!next) return "/account";
  try {
    const resolved = new URL(next, origin);
    return resolved.origin === origin
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : "/account";
  } catch {
    return "/account";
  }
}

/**
 * Whether signing in should start a wedding for someone who has none.
 *
 * Yes, except on the way to an invite: someone arriving to join their
 * partner's wedding who was handed one of their own first could never join
 * — an account is in one wedding at a time.
 */
export function startsAWedding(destination: string): boolean {
  return !destination.startsWith("/invite/");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const next = url.searchParams.get("next");

  const destination = sameOriginPath(next, url.origin);
  let failed = false;
  let client: Awaited<ReturnType<typeof serverClient>> = null;
  let userId: string | null = null;

  try {
    client = await serverClient();
    if (!client) {
      failed = Boolean(code || tokenHash);
    } else if (tokenHash) {
      // The email template can send a token hash instead of a PKCE code. This
      // one carries everything needed with it, so the link works in whatever
      // browser it is opened in — including the one inside a mail app.
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
      failed = Boolean(error);
      userId = data.user?.id ?? null;
    } else if (code) {
      // PKCE. The verifier lives in a cookie set when the link was requested,
      // so this only succeeds in the browser that asked for it.
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      failed = Boolean(error);
      userId = data.user?.id ?? null;
    }

  } catch (error) {
    console.error("[accounts] GET /auth/callback", error);
    failed = true;
  }

  if (client && userId && !failed && startsAWedding(destination)) {
    // Apart from the sign-in: a wedding that could not be started is not a
    // link that did not work, and must not be reported as one. The account
    // page offers to start it by hand.
    try {
      // "You already have a wedding" is the answer for everyone but the
      // first sign-in, and exactly what should happen.
      await createWeddingHandler(accountsStore(client), userId);
    } catch (error) {
      console.error("[accounts] GET /auth/callback: starting a wedding", error);
    }
  }

  const target = new URL(destination, url.origin);
  // A silent failure here is the worst outcome: the user clicked a link, was
  // returned to a page saying "sign in", and had no way to know the link had
  // been opened somewhere it could not work.
  if (failed) target.searchParams.set("signin", "failed");
  return NextResponse.redirect(target);
}
