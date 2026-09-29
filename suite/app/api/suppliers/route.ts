import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { isOnWedding, requestedWedding } from "@/lib/accounts/requestedWedding";
import { check } from "@/lib/server/check";
import { allow, SHARE_LIMIT } from "@/lib/server/rateLimit";
import { publishSchema, takeDownSchema } from "@/lib/suppliers/schemas";
import { supplierStore } from "@/lib/suppliers/supabaseStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () => NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
const unauthenticated = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
const notYours = () => NextResponse.json({ error: "That is not a wedding you are on." }, { status: 404 });
const failed = (where: string, error: unknown) => {
  console.error(`[suppliers] ${where}`, error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

/** The wedding's suppliers' links, keys and confirmations included — for its members. */
export async function GET(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    const client = await serverClient();
    if (!client) return unconfigured();
    const weddingId = await requestedWedding(request, client, user.id);
    if (!weddingId) return notYours();
    return NextResponse.json({ links: await supplierStore(client).linksOf(weddingId) });
  } catch (error) {
    return failed("GET /api/suppliers", error);
  }
}

/** Publish one supplier's sheet, or republish it under the same token and key. */
export async function PUT(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    if (!allow(`suppliers:publish:${user.id}`, SHARE_LIMIT)) {
      return NextResponse.json({ error: "Too many updates. Wait a while and try again." }, { status: 429 });
    }
    const input = check(publishSchema, await request.json().catch(() => null));
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
    const client = await serverClient();
    if (!client) return unconfigured();
    const { weddingId, ...publish } = input.value;
    if (!(await isOnWedding(client, user.id, weddingId))) return notYours();
    const published = await supplierStore(client).publish(weddingId, publish);
    if (!published) return NextResponse.json({ error: "The link was published from elsewhere." }, { status: 409 });
    return NextResponse.json(published);
  } catch (error) {
    return failed("PUT /api/suppliers", error);
  }
}

/** Take one supplier's link down: their copy stops working. */
export async function DELETE(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    const input = check(takeDownSchema, await request.json().catch(() => null));
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
    const client = await serverClient();
    if (!client) return unconfigured();
    if (!(await isOnWedding(client, user.id, input.value.weddingId))) return notYours();
    await supplierStore(client).takeDown(input.value.weddingId, input.value.teamId);
    return NextResponse.json({});
  } catch (error) {
    return failed("DELETE /api/suppliers", error);
  }
}
