import pino from "pino";
import { build } from "@/lib/build";

/**
 * The server's log: one JSON object per line on stdout, which is what Vercel's
 * log view and every log drain parse into searchable fields.
 *
 * Every line names the build that wrote it, so a log line and a Sentry report
 * can be matched to a commit without guessing which deploy was live.
 *
 * Log what happened, never what it happened to: a guest list is the one thing
 * this app exists to keep on the device, and an error object is the only thing
 * logged here that was not written by hand.
 *
 * `LOG_LEVEL` is read here rather than through `env()`, so that the log works
 * when the environment does not — which is when it is needed most. Pino throws
 * on a level it does not know, so a typo still fails at boot.
 */
export const log = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  // Labels rather than pino's numbers, which no log viewer shows as levels.
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { version: build.version, commit: build.commit, env: build.environment },
});

/** Set on every request by `proxy.ts`, and echoed on every response. */
export const REQUEST_ID_HEADER = "x-request-id";

/** The log, for one request: every line it writes carries that request's id. */
export function requestLog(request: Request): pino.Logger {
  return log.child({ requestId: request.headers.get(REQUEST_ID_HEADER) });
}
