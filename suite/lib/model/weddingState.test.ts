// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { weddingState } from "./weddingState";

const example = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.trousseau.json"), "utf8"));

it("says how a wedding stands in a line: what is left, what is next, what is owed", () => {
  expect(weddingState(example, "2026-09-28")).toEqual({
    left: 2,
    blocking: 0,
    next: "3 guests have no table yet.",
    owed: 12540,
  });
});

it("says a wedding with nothing in it has its guest list to start", () => {
  expect(weddingState(null, "2026-09-28")).toMatchObject({ left: 1, next: "No guest list yet. Everything else is built on it.", owed: 0 });
});
