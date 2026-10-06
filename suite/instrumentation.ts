import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { log, REQUEST_ID_HEADER } from "@/lib/server/log";
import { sentryBuild } from "@/lib/sentry/build";
import { dataCollection } from "@/lib/sentry/dataCollection";
import { scrubEvent } from "@/lib/sentry/scrub";

/**
 * Error reporting, and one Node network fix, on the server.
 *
 * `fetch failed` reaching Supabase from a Vercel function, on a host that
 * answers instantly to curl from anywhere else, is Node's well-documented
 * IPv6-first resolution behaviour: `fetch` tries the AAAA record first, the
 * runtime has no route out on it, and the whole attempt is reported as failed
 * rather than falling back to the A record the way a browser would. Forcing
 * IPv4 first is the standard fix and cannot break a path that was working,
 * since it only changes which address is tried first when both exist.
 *
 * Only in the Node.js runtime — the Edge runtime has no `node:dns` and does
 * not need this fix, since it never had the IPv6-first behaviour to begin
 * with.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    ...sentryBuild,
    dataCollection,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
}

/**
 * A throw nothing caught. Logged with its request id and reported with it as a
 * tag, so the log line, the Sentry event and the `X-Request-ID` a person saw
 * are one search apart.
 *
 * The route template (`/api/share/[token]`) rather than the path, which can
 * carry a token.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const requestId = request.headers[REQUEST_ID_HEADER];
  log.error({ err: error, requestId, route: context.routePath }, "unhandled request error");
  Sentry.withScope((scope) => {
    scope.setTag("request_id", String(requestId));
    Sentry.captureRequestError(error, request, context);
  });
};
