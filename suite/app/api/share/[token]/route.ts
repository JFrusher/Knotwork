import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { serverClient } from "@/lib/accounts/serverClient";
import { check } from "@/lib/server/check";
import { tokenSchema } from "@/lib/share/schemas";
import { shareStore } from "@/lib/share/supabaseStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What a guest's link fetches: the sealed snapshot, and nothing that says
 * whose wedding it is. Anyone with the token may ask; only the key after the
 * `#` opens it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!accountsConfigured()) {
      return NextResponse.json({ error: "Guest links are not set up on this deployment." }, { status: 501 });
    }
    const token = check(tokenSchema, (await params).token);
    if (!token.ok) return NextResponse.json({ error: token.error }, { status: 404 });

    const client = await serverClient();
    if (!client) return NextResponse.json({ error: "Guest links are not set up on this deployment." }, { status: 501 });
    const sealed = await shareStore(client).read(token.value);
    if (!sealed) return NextResponse.json({ error: "This link is not live." }, { status: 404 });
    return NextResponse.json(sealed, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[share] GET /api/share/[token]", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
