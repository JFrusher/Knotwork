import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sweepAbandonedDocuments } from "@/lib/documents/handlers";
import { adminDocumentsClient, documentStore } from "@/lib/documents/supabaseStore";
import { sweepHelperLinks } from "@/lib/helpers/supabaseStore";
import { requestLog } from "@/lib/server/log";

/**
 * Retention, once a day: account weddings nobody has written to inside the
 * period the Privacy Policy states, and helpers' links that have run out (the
 * read already refuses them; this tidies the rows away). It deletes
 * unattended, so everything about it is written to fail closed.
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
    const helperLinks = await sweepHelperLinks(adminClient);
    // Counts only: ids identify rows, and a log is no place for them.
    requestLog(request).info({ deleted: deleted.length, helperLinks }, "[Knotwork] retention sweep");
    return NextResponse.json({ deleted: deleted.length, helperLinks });
  } catch (cause) {
    // A failed sweep must be loud: it deletes, it runs unattended, and silence
    // here means data kept past the period the Privacy Policy states.
    requestLog(request).error({ err: cause }, "[Knotwork] retention sweep failed");
    return NextResponse.json({ error: "The sweep failed." }, { status: 503 });
  }
}
