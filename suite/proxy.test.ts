// @vitest-environment node
import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { proxy } from "./proxy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const at = (headers: Record<string, string> = {}, path = "/api/health") =>
  new NextRequest(`http://localhost${path}`, { headers });

/** What a route handler behind the proxy will read as `x-request-id`. */
const forwarded = (response: Response) => response.headers.get("x-middleware-request-x-request-id");

test("a request without an id is given one, echoed and forwarded", async () => {
  const response = await proxy(at());
  const id = response.headers.get("x-request-id");
  expect(id).toMatch(UUID);
  expect(forwarded(response)).toBe(id);
});

test("a caller's id is kept, so a trace crosses from their system into ours", async () => {
  const response = await proxy(at({ "x-request-id": "edge-abc.123:9" }));
  expect(response.headers.get("x-request-id")).toBe("edge-abc.123:9");
  expect(forwarded(response)).toBe("edge-abc.123:9");
});

test("X-Correlation-ID is accepted when X-Request-ID is absent", async () => {
  const response = await proxy(at({ "x-correlation-id": "corr-1" }));
  expect(response.headers.get("x-request-id")).toBe("corr-1");
});

test("an id that could write arbitrary text into the log is replaced", async () => {
  const response = await proxy(at({ "x-request-id": 'x" injected=1' }));
  expect(response.headers.get("x-request-id")).toMatch(UUID);
});

test("an over-long id is replaced", async () => {
  const response = await proxy(at({ "x-request-id": "a".repeat(129) }));
  expect(response.headers.get("x-request-id")).toMatch(UUID);
});

test("a sign-in redirect carries the id too", async () => {
  const response = await proxy(at({ "x-request-id": "signin-1" }, "/?code=abc"));
  expect(response.status).toBe(307);
  expect(response.headers.get("x-request-id")).toBe("signin-1");
  // And the code is still stripped, as before.
  expect(response.headers.get("location")).not.toContain("code=");
});
