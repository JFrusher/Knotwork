// @vitest-environment node
import { expect, test } from "vitest";
import { requestLog } from "./log";

test("every line a request logs carries that request's id", () => {
  const request = new Request("http://localhost/api/x", { headers: { "x-request-id": "req-42" } });
  expect(requestLog(request).bindings()).toEqual({ requestId: "req-42" });
});
