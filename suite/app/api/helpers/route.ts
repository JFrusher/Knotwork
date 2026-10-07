import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { isOnWedding, requestedWedding } from "@/lib/accounts/requestedWedding";
import { check } from "@/lib/server/check";
import { allow, SHARE_LIMIT } from "@/lib/server/rateLimit";
import { publishSchema, takeDownSchema } from "@/lib/helpers/schemas";
import { helperStore } from "@/lib/helpers/supabaseStore";
import { requestLog } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () => NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
const unauthenticated = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
const notYours = () => NextResponse.json({ error: "That is not a wedding you are on." }, { status: 404 });
const failed = (request: Request, where: string, error: unknown) => {
  requestLog(request).error({ err: error }, `[helpers] ${where}`);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

/** The wedding's helpers' links, keys included — for its members. */
export async function GET(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    const client = await serverClient();
    if (!client) return unconfigured();
    const weddingId = await requestedWedding(request, client, user.id);
    if (!weddingId) return notYours();
    return NextResponse.json({ links: await helperStore(client).linksOf(weddingId) });
  } catch (error) {
    return failed(request, "GET /api/helpers", error);
  }
}

/** Publish one helper's sheet, or republish it under the same token and key. */
export async function PUT(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    if (!allow(`helpers:publish:${user.id}`, SHARE_LIMIT)) {
      return NextResponse.json({ error: "Too many updates. Wait a while and try again." }, { status: 429 });
    }
    const input = check(publishSchema, await request.json().catch(() => null));
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
    const client = await serverClient();
    if (!client) return unconfigured();
    const { weddingId, ...publish } = input.value;
    if (!(await isOnWedding(client, user.id, weddingId))) return notYours();
    const published = await helperStore(client).publish(weddingId, publish);
    if (!published) return NextResponse.json({ error: "The link was published from elsewhere." }, { status: 409 });
    return NextResponse.json(published);
  } catch (error) {
    return failed(request, "PUT /api/helpers", error);
  }
}

/** Take one helper's link down: their copy stops working. */
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
    await helperStore(client).takeDown(input.value.weddingId, input.value.personId);
    return NextResponse.json({});
  } catch (error) {
    return failed(request, "DELETE /api/helpers", error);
  }
}
