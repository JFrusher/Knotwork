import type * as Sentry from "@sentry/nextjs";

type DataCollection = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"]>;

/**
 * What the SDK may gather on its own, passed to both `Sentry.init` calls:
 * nothing about a person.
 *
 * Sentry 11 replaced `sendDefaultPii: false` with this, and inverted the
 * default — every category left out is collected. A report here is about a
 * broken line of code, never about whose wedding it broke on, and request
 * bodies, headers, cookies and local variables are exactly where guest names,
 * emails and session tokens sit.
 *
 * `Required` on purpose: when Sentry adds a category, the build fails here
 * rather than the new category quietly defaulting to on.
 */
export const dataCollection: Required<DataCollection> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  // Lines of this app's own source around a frame. The source is public
  // (AGPL), so this says nothing about anyone.
  frameContextLines: 5,
};
