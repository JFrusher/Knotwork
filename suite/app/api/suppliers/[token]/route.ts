import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { serverClient } from "@/lib/accounts/serverClient";
import { check } from "@/lib/server/check";
import { allow, CONFIRM_LIMIT } from "@/lib/server/rateLimit";
import { tokenSchema } from "@/lib/suppliers/schemas";
import { supplierStore } from "@/lib/suppliers/supabaseStore";
import { requestLog } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () => NextResponse.json({ error: "Supplier links are not set up on this deployment." }, { status: 501 });
const gone = () => NextResponse.json({ error: "This link is not live." }, { status: 404 });
const failed = (request: Request, where: string, error: unknown) => {
  requestLog(request).error({ err: error }, `[suppliers] ${where}`);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

/** What a supplier's link fetches: their sheet, sealed, and when they confirmed it. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const token = check(tokenSchema, (await params).token);
    if (!token.ok) return gone();
    const client = await serverClient();
    if (!client) return unconfigured();
    const sealed = await supplierStore(client).read(token.value);
    if (!sealed) return gone();
    return NextResponse.json(sealed, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failed(request, "GET /api/suppliers/[token]", error);
  }
}

/** The supplier says they have it: when, recorded against their link and nothing else. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const token = check(tokenSchema, (await params).token);
    if (!token.ok) return gone();
    if (!allow(`suppliers:confirm:${token.value}`, CONFIRM_LIMIT)) {
      return NextResponse.json({ error: "Confirmed already. Wait a while to confirm again." }, { status: 429 });
    }
    const client = await serverClient();
    if (!client) return unconfigured();
    const confirmedAt = await supplierStore(client).confirm(token.value);
    if (!confirmedAt) return gone();
    return NextResponse.json({ confirmedAt });
  } catch (error) {
    return failed(request, "POST /api/suppliers/[token]", error);
  }
}
