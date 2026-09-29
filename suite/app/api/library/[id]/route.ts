import { NextResponse } from "next/server";
import { z } from "zod";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { libraryStore } from "@/lib/library/supabaseStore";
import { getHandler, removeHandler } from "@/lib/library/handlers";
import { check } from "@/lib/server/check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () => NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });
const missing = () => NextResponse.json({ error: "That is not in your library." }, { status: 404 });
const failed = (where: string, error: unknown) => {
  console.error(`[library] ${where}`, error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
};

async function owner(): Promise<{ id: string; client: NonNullable<Awaited<ReturnType<typeof serverClient>>> } | NextResponse> {
  if (!accountsConfigured()) return unconfigured();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const client = await serverClient();
  if (!client) return unconfigured();
  return { id: user.id, client };
}

/** One kept design, to put into the open wedding. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const who = await owner();
    if (who instanceof NextResponse) return who;
    const id = check(z.string().uuid(), (await params).id);
    if (!id.ok) return missing();
    const reply = await getHandler(libraryStore(who.client), who.id, id.value);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed("GET /api/library/[id]", error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const who = await owner();
    if (who instanceof NextResponse) return who;
    const id = check(z.string().uuid(), (await params).id);
    if (!id.ok) return missing();
    const reply = await removeHandler(libraryStore(who.client), who.id, id.value);
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (error) {
    return failed("DELETE /api/library/[id]", error);
  }
}
