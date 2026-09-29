import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { isOnWedding, requestedWedding } from "@/lib/accounts/requestedWedding";
import { check } from "@/lib/server/check";
import { allow, SHARE_LIMIT } from "@/lib/server/rateLimit";
import { publishSchema, takeDownSchema } from "@/lib/share/schemas";
import { shareStore } from "@/lib/share/supabaseStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () =>
  NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
const unauthenticated = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
const notYours = () => NextResponse.json({ error: "That is not a wedding you are on." }, { status: 404 });
/** An uncaught throw becomes an HTML 500 the page cannot read. */
const failed = (where: string, error: unknown) => {
  console.error(`[share] ${where}`, error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

/** The wedding's guest link, key included — for its members, who republish it. */
export async function GET(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    const client = await serverClient();
    if (!client) return unconfigured();

    const weddingId = await requestedWedding(request, client, user.id);
    if (!weddingId) return notYours();
    return NextResponse.json({ link: await shareStore(client).linkOf(weddingId) });
  } catch (error) {
    return failed("GET /api/share", error);
  }
}

/** Publish, or republish under the same token and key. */
export async function PUT(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();
    const user = await currentUser();
    if (!user) return unauthenticated();
    if (!allow(`share:publish:${user.id}`, SHARE_LIMIT)) {
      return NextResponse.json({ error: "Too many updates. Wait a while and try again." }, { status: 429 });
    }

    const input = check(publishSchema, await request.json().catch(() => null));
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    const client = await serverClient();
    if (!client) return unconfigured();
    const { weddingId, ...publish } = input.value;
    if (!(await isOnWedding(client, user.id, weddingId))) return notYours();
    const published = await shareStore(client).publish(weddingId, publish);
    // Another device published first, under its own key: read the link again
    // and seal with that one.
    if (!published) return NextResponse.json({ error: "The link was published from elsewhere." }, { status: 409 });
    return NextResponse.json(published);
  } catch (error) {
    return failed("PUT /api/share", error);
  }
}

/** Take the link down: every copy of it stops working. */
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
    await shareStore(client).takeDown(input.value.weddingId);
    return NextResponse.json({});
  } catch (error) {
    return failed("DELETE /api/share", error);
  }
}
