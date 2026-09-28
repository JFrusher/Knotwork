import { scrubEvent } from "@/lib/sentry/scrub";

/**
 * Error reporting in the browser, off unless a DSN is configured.
 *
 * Configured deliberately narrowly, because a default install would contradict
 * the promise the front page makes. No session replay — that records the
 * screen, and the screen is the guest list. No PII. No performance tracing, so
 * nothing is sent for a page that did not break.
 *
 * `beforeSend` is the part that must not be removed: see `lib/sentry/scrub.ts`.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Imported only when a DSN is configured. `NEXT_PUBLIC_` values are inlined at
// build time, so without one this branch is dead code and the SDK, about half
// a megabyte of script, is never downloaded. A static import kept it in the
// first load of every page whether it was used or not. The cost when a DSN is
// set: an error in the moment before the SDK arrives goes unreported.
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      // A report is sent only when something breaks.
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      // Breadcrumbs are kept for navigation and clicks, which say where an
      // error happened. Console breadcrumbs are not: the tools log document
      // contents while working, and that is the wedding.
      beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
    }),
  );
}
