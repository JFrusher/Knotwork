// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

let client: unknown = null;

vi.mock("@/lib/documents/supabaseStore", () => ({ adminDocumentsClient: () => client }));
vi.mock("@/lib/env", () => ({
  accountsConfigured: () => client !== null,
  env: () => ({ NEXT_PUBLIC_SENTRY_DSN: undefined }),
}));

// What Next's `env` option inlines at build time; vitest has no build to do it.
vi.stubEnv("APP_VERSION", "0.1.0");
vi.stubEnv("GIT_COMMIT_SHA", "abc1234");
vi.stubEnv("BUILD_TIMESTAMP", "2026-10-01T00:00:00.000Z");
vi.stubEnv("APP_ENV", "production");

const { GET } = await import("./route");

const request = () => new Request("http://localhost/api/health", { headers: { "x-request-id": "health-1" } });

/** A Supabase client whose one query answers with `error`. */
const answering = (error: unknown) => {
  const query = { select: () => query, limit: async () => ({ error }) };
  return { from: () => query };
};

beforeEach(() => {
  client = null;
});

test("a deployment with no backend is healthy, not degraded", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.checks).toEqual({
    database: "not_configured",
    accounts: "not_configured",
    errorReporting: "not_configured",
  });
});

test("a database that answers is ok", async () => {
  client = answering(null);
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect((await response.json()).checks.database).toBe("ok");
});

test("a database that does not answer is a 503 an uptime monitor will see", async () => {
  client = answering({ message: "TypeError: fetch failed" });
  const response = await GET(request());
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.status).toBe("degraded");
  expect(body.checks.database).toBe("down");
});

test("the build is named, and nothing about the configuration but whether it exists", async () => {
  client = answering(null);
  const body = await (await GET(request())).json();
  expect(body).toMatchObject({
    version: "0.1.0",
    commit: "abc1234",
    builtAt: "2026-10-01T00:00:00.000Z",
    environment: "production",
  });
  expect(JSON.stringify(body)).not.toContain("supabase");
});
