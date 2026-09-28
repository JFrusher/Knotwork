import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { createWeddingHandler, listWeddingsHandler } from "@/lib/accounts/handlers";
import { accountsStore } from "@/lib/accounts/supabaseStore";
import { documentStore } from "@/lib/documents/supabaseStore";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { check, newWeddingSchema } from "@/lib/accounts/schemas";
import { allow, CREATE_LIMIT } from "@/lib/sync/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () =>
  NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
const unauthenticated = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
const throttled = () =>
  NextResponse.json({ error: "Too many requests. Wait a while and try again." }, { status: 429 });

/**
 * Anything thrown past the specific checks is a genuine surprise — a failed
 * RPC, a database that isn't answering. Without this the exception escapes
 * into Next's default 500, whose body is HTML: the browser's `response.json()`
 * then rejects and the calling page hangs on its loading state forever.
 */
const failed = (where: string, error: unknown) => {
  console.error(`[accounts] ${where}`, error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

/** Every wedding this account is on — the couple's own, and a planner's clients. */
export async function GET() {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    const client = await serverClient();
    if (!client) return unconfigured();

    const reply = await listWeddingsHandler(accountsStore(client), documentStore(client), user.id);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed("GET /api/accounts/weddings", error);
  }
}

/** Start a wedding: the couple's own (made at sign-in), or a planner's for a client. */
export async function POST(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();

    if (!allow(`accounts:create-wedding:${user.id}`, CREATE_LIMIT)) return throttled();

    const input = check(newWeddingSchema, await request.json().catch(() => null));
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    const client = await serverClient();
    if (!client) return unconfigured();

    const reply = await createWeddingHandler(accountsStore(client), user.id, input.value.role);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed("POST /api/accounts/weddings", error);
  }
}
