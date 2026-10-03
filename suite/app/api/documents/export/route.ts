import { NextResponse } from "next/server";
import { accountsConfigured } from "@/lib/env";
import { currentUser, serverClient } from "@/lib/accounts/serverClient";
import { requestedWedding } from "@/lib/accounts/requestedWedding";
import { documentStore } from "@/lib/documents/supabaseStore";
import { exportDocumentHandler } from "@/lib/documents/handlers";
import { allow, EXPORT_LIMIT } from "@/lib/server/rateLimit";
import { requestLog } from "@/lib/server/log";

/**
 * "Download my wedding" — the honest answer to "can I get my data out".
 *
 * Also the migration path off the hosted instance: the file this returns is
 * the same `.knotwork.json` a self-hosted instance, or the local-only mode,
 * will open. There is no export format to keep in step, because there is no
 * separate export format.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unconfigured = () =>
  NextResponse.json({ error: "Accounts are not set up on this deployment." }, { status: 501 });

export async function GET(request: Request) {
  try {
    if (!accountsConfigured()) return unconfigured();

    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    // Keyed by account, as on the write path. The whole document is the
    // largest response this API produces, so it gets its own ceiling.
    if (!allow(`documents:export:${user.id}`, EXPORT_LIMIT)) {
      return NextResponse.json(
        { error: "Too many downloads. Try again a little later." },
        { status: 429 },
      );
    }

    const client = await serverClient();
    if (!client) return unconfigured();

    // Only a wedding the caller is on. RLS enforces the same thing a second
    // time at the database.
    const weddingId = await requestedWedding(request, client, user.id);
    if (!weddingId) {
      return NextResponse.json({ error: "That is not a wedding you are on." }, { status: 404 });
    }

    const reply = await exportDocumentHandler(documentStore(client), weddingId);
    if (reply.status === 404) return NextResponse.json(reply.body, { status: 404 });

    return new NextResponse(reply.file.text, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${reply.file.filename}"`,
        // A wedding is personal data. Never let a shared cache hold it.
        "cache-control": "no-store, private",
      },
    });
  } catch (error) {
    requestLog(request).error({ err: error }, "[documents] GET /api/documents/export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
