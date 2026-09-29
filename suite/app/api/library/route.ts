import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { libraryStore } from "@/lib/library/supabaseStore";
import { listHandler, saveHandler } from "@/lib/library/handlers";
import { allow, LIBRARY_LIMIT } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () => NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
const unauthenticated = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
const failed = (where: string, error: unknown) => {
  console.error(`[library] ${where}`, error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

/** What this account has kept, newest first. */
export async function GET() {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    const client = await serverClient();
    if (!client) return unconfigured();
    const reply = await listHandler(libraryStore(client), user.id);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed("GET /api/library", error);
  }
}

/** Keep a design: `{ kind, name, content }`, already stripped of anything personal. */
export async function POST(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    if (!allow(`library:save:${user.id}`, LIBRARY_LIMIT)) {
      return NextResponse.json({ error: "Too many saves. Wait a while and try again." }, { status: 429 });
    }
    const client = await serverClient();
    if (!client) return unconfigured();
    const reply = await saveHandler(libraryStore(client), user.id, await request.json().catch(() => null));
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed("POST /api/library", error);
  }
}
