import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { requestedWedding } from "@/lib/accounts/requestedWedding";
import { accountsStore } from "@/lib/accounts/supabaseStore";
import { documentStore } from "@/lib/documents/supabaseStore";
import { historyHandler } from "@/lib/documents/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The wedding's saved versions, newest first, and who saved each. */
export async function GET(request: Request) {
  try {
    if (!accountsConfigured()) return NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const client = await serverClient();
    if (!client) return NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
    const weddingId = await requestedWedding(request, client, user.id);
    if (!weddingId) return NextResponse.json({ error: "That is not a wedding you are on." }, { status: 404 });

    const people = await accountsStore(client).peopleOf(weddingId, user.id);
    const reply = await historyHandler(documentStore(client), people, weddingId, user.id);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    console.error("[documents] GET /api/documents/history", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
