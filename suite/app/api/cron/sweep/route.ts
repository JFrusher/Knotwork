import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sweepAbandonedDocuments } from "@/lib/documents/handlers";
import { adminDocumentsClient, documentStore } from "@/lib/documents/supabaseStore";

/**
 * Retention, once a day: account weddings nobody has written to inside the
 * period the Privacy Policy states. It deletes unattended, so everything about
 * it is written to fail closed.
 *
 * No `CRON_SECRET` means every request is refused, including Vercel's. An
 * endpoint that deletes and has no credential configured must do nothing rather
 * than trust its caller.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { CRON_SECRET } = env();
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "No sweep is configured." }, { status: 501 });
  }

  const presented = request.headers.get("authorization");
  if (presented !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "No." }, { status: 401 });
  }

  const adminClient = adminDocumentsClient();
  if (!adminClient) return NextResponse.json({ error: "No backend." }, { status: 501 });

  try {
    const { deleted } = await sweepAbandonedDocuments(documentStore(adminClient));
    // A count only: ids identify rows, and a log is no place for them.
    console.info(`[Trousseau] retention sweep removed ${deleted.length} wedding(s)`);
    return NextResponse.json({ deleted: deleted.length });
  } catch (cause) {
    // A failed sweep must be loud: it deletes, it runs unattended, and silence
    // here means data kept past the period the Privacy Policy states.
    console.error("[Trousseau] retention sweep failed:", cause);
    return NextResponse.json({ error: "The sweep failed." }, { status: 503 });
  }
}
