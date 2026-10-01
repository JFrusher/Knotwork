import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { peopleHandler, removeMemberHandler } from "@/lib/accounts/handlers";
import { accountsStore } from "@/lib/accounts/supabaseStore";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { check, removeMemberSchema } from "@/lib/accounts/schemas";
import { requestLog } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () =>
  NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
const unauthenticated = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
/** See `../weddings/route.ts`: an uncaught throw becomes an HTML 500 the UI can't parse. */
const failed = (request: Request, where: string, error: unknown) => {
  requestLog(request).error({ err: error }, `[accounts] ${where}`);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

/** Who has access to `?wedding=`: the couple and their planner, with addresses. */
export async function GET(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    const client = await serverClient();
    if (!client) return unconfigured();

    const weddingId = new URL(request.url).searchParams.get("wedding") ?? "";
    const reply = await peopleHandler(accountsStore(client), weddingId, user.id);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed(request, "GET /api/accounts/members", error);
  }
}

/** Leave a wedding, or — one of the couple — remove its planner. */
export async function DELETE(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();

    const input = check(removeMemberSchema, await request.json().catch(() => null));
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    const client = await serverClient();
    if (!client) return unconfigured();

    const reply = await removeMemberHandler(accountsStore(client), input.value.weddingId, user.id, input.value.userId);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed(request, "DELETE /api/accounts/members", error);
  }
}
