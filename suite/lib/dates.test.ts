// @vitest-environment node
import { expect, it } from "vitest";
import { daysUntil, longDate } from "./dates";

it("counts days to a date, negative once passed, across a change of clocks", () => {
  expect(daysUntil("2028-05-18", "2028-05-01")).toBe(17);
  expect(daysUntil("2028-03-26", "2028-03-27")).toBe(-1);
});

it("writes a date out in words", () => {
  expect(longDate("2028-06-01")).toBe("1 June 2028");
});
