import { expect, test } from "vitest";
import { emptyTrousseau } from "@jfrusher/trousseau";
import { describe, hasContent, summarise } from "./content";

const empty = emptyTrousseau();

test("an empty wedding has nothing to lose", () => {
  expect(hasContent(summarise(empty))).toBe(false);
});

test("the defaults a tool stores just by being opened are not content", () => {
  // What Timeline, Place cards and Delegation store on a fresh device before
  // anyone types anything — measured in the browser, not assumed.
  const opened = {
    ...empty,
    crew: { teams: [], people: [], jobs: [], budget: null },
    stationery: { version: 2, card: { widthMm: 85 }, rows: [], headers: [] },
  };
  expect(hasContent(summarise(opened))).toBe(false);
});

test.each([
  ["names", { event: { ...empty.event, coupleNames: "Alex & Sam" } }],
  ["a date", { event: { ...empty.event, date: "2027-06-12" } }],
  ["a guest", { guests: { g1: { id: "g1", firstName: "Ann" } } }],
  ["a group shot", { shots: { ...empty.shots, sections: [{ id: "s", name: "Family", shots: [{ id: "x", label: "", members: [], notes: "" }] }] } }],
  ["a crew member", { crew: { teams: [], people: [{ id: "p1", name: "Jo" }], jobs: [], budget: null } }],
  ["a group in the processional", { ceremony: { processional: [{ id: "w1", label: "", members: [] }] } }],
])("%s is content", (_, part) => {
  expect(hasContent(summarise({ ...empty, ...part }))).toBe(true);
});

test("a wedding is described by its names and what is in it", () => {
  const raw = {
    ...empty,
    event: { ...empty.event, coupleNames: "Alex & Sam" },
    guests: { g1: { id: "g1", firstName: "Ann" }, g2: { id: "g2", firstName: "Bo" } },
  };
  expect(describe(summarise(raw))).toBe("Alex & Sam — 2 guests");
  expect(describe(summarise(empty))).toBe("A wedding with no names yet");
});
