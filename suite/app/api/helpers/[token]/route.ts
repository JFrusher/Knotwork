import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { serverClient } from "@/lib/accounts/serverClient";
import { check } from "@/lib/server/check";
import { tokenSchema } from "@/lib/helpers/schemas";
import { helperStore } from "@/lib/helpers/supabaseStore";
import { requestLog } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () => NextResponse.json({ error: "Helper links are not set up on this deployment." }, { status: 501 });
const gone = () => NextResponse.json({ error: "This link is not live." }, { status: 404 });

/** What a helper's link fetches: their sheet, sealed. Nothing once taken down or run out. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const token = check(tokenSchema, (await params).token);
    if (!token.ok) return gone();
    const client = await serverClient();
    if (!client) return unconfigured();
    const sealed = await helperStore(client).read(token.value);
    if (!sealed) return gone();
    return NextResponse.json(sealed, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    requestLog(request).error({ err: error }, "[helpers] GET /api/helpers/[token]");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
