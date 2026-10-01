/**
 * Which build this is: what a bug report needs first, and what nothing in the
 * running app could otherwise tell you.
 *
 * Computed once by `buildInfo()` in `next.config.ts` and inlined by Next's
 * `env` option, so the server, the proxy and the browser all read the same
 * strings. Safe to import anywhere, the browser included.
 */
export const build = {
  /** `version` from this workspace's package.json. */
  version: process.env.APP_VERSION as string,
  /** Short commit hash. */
  commit: process.env.GIT_COMMIT_SHA as string,
  /** ISO time the build started. */
  builtAt: process.env.BUILD_TIMESTAMP as string,
  /** `production`, `preview` or `development` on Vercel; NODE_ENV elsewhere. */
  environment: process.env.APP_ENV as string,
};

declare global {
  interface Window {
    /** Set by `instrumentation-client.ts` on every page. */
    appVersion: typeof build;
  }
}
