import { NextResponse } from "next/server";
import { z } from "zod";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { requestedWedding } from "@/lib/accounts/requestedWedding";
import { documentStore } from "@/lib/documents/supabaseStore";
import { historyDocumentHandler } from "@/lib/documents/handlers";
import { check } from "@/lib/server/check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One saved version of the wedding, to look at or put back. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!accountsConfigured()) return NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const client = await serverClient();
    if (!client) return NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
    const weddingId = await requestedWedding(request, client, user.id);
    if (!weddingId) return NextResponse.json({ error: "That is not a wedding you are on." }, { status: 404 });

    // A version is a uuid; anything else is not one, rather than a database error.
    const id = check(z.string().uuid(), (await params).id);
    if (!id.ok) return NextResponse.json({ error: "That version is not in this wedding's history." }, { status: 404 });
    const reply = await historyDocumentHandler(documentStore(client), weddingId, id.value);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    console.error("[documents] GET /api/documents/history/[id]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
