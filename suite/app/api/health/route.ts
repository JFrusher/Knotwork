import { NextResponse } from "next/server";
import { build } from "@/lib/build";
import { accountsConfigured, env } from "@/lib/env";
import { adminDocumentsClient } from "@/lib/documents/supabaseStore";
import { requestLog } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Database = "ok" | "down" | "not_configured";

/**
 * For an uptime monitor, and for a person asking which build is live.
 *
 * 200 when everything this deployment is configured to use answers, 503 when
 * something does not. A deployment with no backend is healthy: local-only is a
 * supported way to run this, not a degraded one.
 *
 * Says what is configured, never with what: no URL, key or row leaves here.
 */
export async function GET(request: Request) {
  const database = await databaseStatus(request);
  const status = database === "down" ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      version: build.version,
      commit: build.commit,
      builtAt: build.builtAt,
      environment: build.environment,
      checks: {
        database,
        accounts: accountsConfigured() ? "configured" : "not_configured",
        errorReporting: env().NEXT_PUBLIC_SENTRY_DSN ? "configured" : "not_configured",
      },
    },
    { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * A head-only read of the table every account wedding lives in: proves the
 * database answers and the service key is accepted, and returns no rows.
 */
async function databaseStatus(request: Request): Promise<Database> {
  const client = adminDocumentsClient();
  if (!client) return "not_configured";

  const { error } = await client.from("wedding_documents").select("wedding_id", { head: true }).limit(1);
  if (!error) return "ok";

  requestLog(request).warn({ err: error }, "[health] database check failed");
  return "down";
}
