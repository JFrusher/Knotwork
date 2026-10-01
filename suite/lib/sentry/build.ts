import { build } from "@/lib/build";

/**
 * Which build a report came from, spread into both `Sentry.init` calls so the
 * browser and the server cannot describe the same deploy differently.
 *
 * The release is what Sentry groups regressions by ("first seen in"); the tags
 * make the version and commit filterable on every event.
 */
export const sentryBuild = {
  release: `trousseau-suite@${build.version}+${build.commit}`,
  environment: build.environment,
  initialScope: { tags: { app_version: build.version, commit: build.commit } },
};
