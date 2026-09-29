import { describe, expect, it } from "vitest";
import { parseDay } from "./day";

const day = (utcOffsetMin: unknown) =>
  JSON.stringify({
    kind: "cadence.day",
    version: 1,
    appVersion: "",
    day: { date: "2028-12-12", coupleNames: "Alex & Sam", venueName: "", curfewMin: 1440, utcOffsetMin },
    lanes: ["Main day"],
    blocks: [],
  });

describe("reading the day's clocks", () => {
  it("takes a day whose clocks nobody has set, as unset", () => {
    const result = parseDay(day(null));
    expect(result.error).toBeUndefined();
    expect(result.day?.utcOffsetMin).toBeNull();
  });

  it("takes a day whose clocks are set", () => {
    expect(parseDay(day(0)).day?.utcOffsetMin).toBe(0);
  });

  it("refuses a day with no word on its clocks at all", () => {
    expect(parseDay(day(undefined))).toEqual({ error: "The day is missing utcOffsetMin." });
  });
});
