import { defineConfig } from "@playwright/test";

/**
 * Browser tests against a production build: `npm run build -w suite`, then
 * `npm run e2e -w suite`. They cover what the unit tests cannot see — what
 * axe finds on each page, whether the tools work from a keyboard, where a drop
 * lands on the canvas, and whether an edit survives a reload.
 *
 * @playwright/test is pinned to 1.56.1 because its Chromium build (1194) is the
 * one preinstalled in Claude Code's cloud environment, so the suite runs there
 * without a download. CI installs the same build with `playwright install`.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
    browserName: "chromium",
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
  },
});
