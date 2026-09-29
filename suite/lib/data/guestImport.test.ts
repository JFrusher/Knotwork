import { expect, test } from "vitest";
import { parseCsv, toCsv } from "./csv";
import { applyImport, guessMapping, guessRsvpMeaning, guessSideMeaning, planImport, rsvpAnswers, sideAnswers } from "./guestImport";
import { newGuest } from "@/lib/model/factories";
import type { Guest } from "@/lib/model/types";

test("quoted fields, embedded newlines and CRLF all survive the parse", () => {
  const table = parseCsv(
    'First Name,Last Name,Notes\r\nCharis,"Smith","two lines\nhere"\r\nAlexander,Wright,""\r\n',
  );
  expect(table.headers).toEqual(["First Name", "Last Name", "Notes"]);
  expect(table.rows).toHaveLength(2);
  expect(table.rows[0]!["Notes"]).toBe("two lines\nhere");
});

test("an unterminated quote is refused rather than swallowing the file", () => {
  expect(() => parseCsv('Name\r\n"Charis\r\nAlexander\r\n')).toThrow(/Unterminated quote/);
});

test("duplicate headers are kept apart instead of overwriting each other", () => {
  const table = parseCsv("Notes,Notes\r\nfrom rsvp,from venue\r\n");
  expect(table.headers).toEqual(["Notes", "Notes (2)"]);
  expect(table.rows[0]).toEqual({ Notes: "from rsvp", "Notes (2)": "from venue" });
});

test("a cell that would execute as a formula is neutralised on the way out", () => {
  expect(toCsv(["Name"], [["=cmd|'/c calc'!A1"]])).toContain("'=cmd");
});

test("the PRD's own sample columns are all recognised", () => {
  const mapping = guessMapping(["First Name", "Last Name", "Table", "Dietary", "Entree"]);
  expect(mapping.firstName).toBe("First Name");
  expect(mapping.lastName).toBe("Last Name");
  expect(mapping.dietary).toBe("Dietary");
  expect(mapping.entree).toBe("Entree");
});

/** Import a CSV onto an existing list, with the RSVP answers read the default way. */
function plan(csv: string, existing: Record<string, Guest> = {}) {
  const table = parseCsv(csv);
  const mapping = guessMapping(table.headers);
  return planImport(table, mapping, { rsvp: guessRsvpMeaning(rsvpAnswers(table, mapping)), side: {} }, existing);
}

test("a name in one column is split into first and last", () => {
  const { added } = plan("Name\r\nEleanor Vane\r\nMadonna\r\n");
  expect(added.map((g) => [g.firstName, g.lastName])).toEqual([
    ["Eleanor", "Vane"],
    ["Madonna", ""],
  ]);
});

test("re-importing an updated list keeps the seating already done", () => {
  const seated = newGuest({ id: "g1", firstName: "Charis", lastName: "Smith", assignedTableId: "t4" });

  const result = plan("First Name,Last Name,Dietary,RSVP\r\nCharis,Smith,Vegetarian,yes\r\n", { g1: seated });

  expect(Object.keys(result.guests)).toEqual(["g1"]);
  expect(result.guests["g1"]).toMatchObject({ dietary: "vegetarian", dietaryRaw: "Vegetarian", rsvpStatus: "confirmed" });
  // The plan on the canvas is the truth. A CSV must never unseat anybody.
  expect(result.guests["g1"]!.assignedTableId).toBe("t4");
  expect(result.updated.map((g) => g.id)).toEqual(["g1"]);
});

test("rows with no name at all are counted rather than invented", () => {
  // A wholly blank line is dropped by the parser; this row has content, just
  // nothing that names anybody — a stray note left in the spreadsheet.
  const result = plan("First Name,Last Name,Notes\r\nCharis,Smith,\r\n,,ask about parking\r\n");
  expect(result.added).toHaveLength(1);
  expect(result.skipped).toBe(1);
});

test("a diet answered 'None' is no requirement, and the answer is kept", () => {
  const { added } = plan("Name,Dietary\r\nPriya Castellanos,None\r\n");
  expect(added[0]).toMatchObject({ dietary: "", dietaryRaw: "None" });
});

test("an email finds someone whatever the file calls them", () => {
  const existing = { g1: newGuest({ id: "g1", firstName: "Liz", lastName: "Hale", email: "liz@example.com" }) };
  const result = plan("Name,Email,RSVP\r\nElizabeth Hale,LIZ@example.com,Yes\r\n", existing);
  expect(result.added).toHaveLength(0);
  // Found by email, so they keep the name the couple gave them.
  expect(result.guests["g1"]).toMatchObject({ firstName: "Liz", rsvpStatus: "confirmed" });
});

test("two people with one name and different emails are two people", () => {
  const existing = { g1: newGuest({ id: "g1", firstName: "Sam", lastName: "Smith", email: "sam@one.com" }) };
  const result = plan("Name,Email\r\nSam Smith,sam@two.com\r\n", existing);
  expect(result.added).toHaveLength(1);
  expect(result.guests["g1"]!.email).toBe("sam@one.com");
});

test("a name two guests share is held back rather than guessed at", () => {
  const existing = {
    a: newGuest({ id: "a", firstName: "Sarah", lastName: "Smith" }),
    b: newGuest({ id: "b", firstName: "Sarah", lastName: "Smith" }),
  };
  const result = plan("Name,Dietary\r\nSarah Smith,Vegan\r\n", existing);
  // Neither Sarah is edited, and a third is not quietly added.
  expect(result.updated).toHaveLength(0);
  expect(result.added).toHaveLength(0);
  expect(result.ambiguous.map((g) => g.firstName)).toEqual(["Sarah"]);
  expect(Object.keys(result.guests)).toEqual(["a", "b"]);
});

test("each row is a person, even when two rows share a name", () => {
  const result = plan("Name\r\nSam Smith\r\nSam Smith\r\n");
  expect(result.added).toHaveLength(2);
});

test("people already on the list and not in the file are listed, not removed", () => {
  const existing = {
    a: newGuest({ id: "a", firstName: "Ann", lastName: "Lee" }),
    b: newGuest({ id: "b", firstName: "Bo", lastName: "Ray" }),
  };
  const result = plan("Name\r\nAnn Lee\r\n", existing);
  expect(result.missing.map((g) => g.id)).toEqual(["b"]);
  expect(Object.keys(result.guests).sort()).toEqual(["a", "b"]);
  expect(result.unchanged).toBe(1);
});

test("an RSVP left blank keeps the answer already recorded", () => {
  const existing = { a: newGuest({ id: "a", firstName: "Ann", lastName: "Lee", rsvpStatus: "confirmed" }) };
  const result = plan("Name,RSVP\r\nAnn Lee,\r\n", existing);
  expect(result.guests["a"]!.rsvpStatus).toBe("confirmed");
});

test("the couple can say what an unfamiliar RSVP answer means", () => {
  const table = parseCsv("Name,Attending\r\nAnn Lee,Joyfully accepts\r\nBo Ray,Regretfully declines\r\n");
  const mapping = guessMapping(table.headers);
  const answers = rsvpAnswers(table, mapping);
  expect(answers).toEqual(["Joyfully accepts", "Regretfully declines"]);
  // Neither is a word the guess knows, so both start as no answer yet…
  const guessed = guessRsvpMeaning(answers);
  expect(Object.values(guessed)).toEqual(["pending", "pending"]);
  // …and what the couple says is what is used.
  const result = planImport(
    table,
    mapping,
    { rsvp: { "Joyfully accepts": "confirmed", "Regretfully declines": "declined" }, side: {} },
    {},
  );
  expect(result.added.map((g) => g.rsvpStatus)).toEqual(["confirmed", "declined"]);
});

test("applying writes the chosen extra people in and the chosen missing ones out", () => {
  const existing = {
    a: newGuest({ id: "a", firstName: "Sarah", lastName: "Smith", assignedTableId: "t1" }),
    b: newGuest({ id: "b", firstName: "Sarah", lastName: "Smith" }),
    c: newGuest({ id: "c", firstName: "Cy", lastName: "Old" }),
  };
  const result = plan("Name\r\nSarah Smith\r\n", existing);
  const held = result.ambiguous[0]!;
  const seating = { tables: { t1: { id: "t1", seatMode: "table", assignedGuestIds: ["a", "c"] } } };

  const written = applyImport(result, { add: new Set([held.id]), remove: new Set(["c"]) }, seating);

  expect(Object.keys(written.guests).sort()).toEqual(["a", "b", held.id].sort());
  expect((written.seating!["tables"] as Record<string, { assignedGuestIds: string[] }>)["t1"]!.assignedGuestIds).toEqual(["a"]);
});

test("an import that removes nobody leaves the seating alone", () => {
  const written = applyImport(plan("Name\r\nAnn Lee\r\n"), { add: new Set(), remove: new Set() }, { tables: {} });
  expect(written.seating).toBeNull();
});

test("re-importing over a guest keeps their groups, tags and plus-one", () => {
  const existing = {
    a: newGuest({
      id: "a",
      firstName: "Ann",
      lastName: "Lee",
      groupId: "college",
      familyId: "lees",
      tags: ["usher"],
      plusOneOf: "b",
    }),
  };
  const result = plan("Name,Notes\r\nAnn Lee,from the RSVP\r\n", existing);
  expect(result.guests["a"]).toMatchObject({
    groupId: "college",
    familyId: "lees",
    tags: ["usher"],
    plusOneOf: "b",
    notes: "from the RSVP",
  });
});

test("two rows cannot both be the one guest already on the list", () => {
  const existing = { a: newGuest({ id: "a", firstName: "Ann", lastName: "Lee" }) };
  const result = plan("Name,Dietary\r\nAnn Lee,Vegan\r\nAnn Lee,Halal\r\n", existing);
  // The first is her; the second is someone else with her name.
  expect(result.guests["a"]!.dietary).toBe("vegan");
  expect(result.added).toHaveLength(1);
  expect(result.added[0]!.dietary).toBe("halal");
});

test("a side is whoever the couple says each answer means", () => {
  const table = parseCsv("Name,Side\r\nAnn Lee,Alex's family\r\nBo Ray,Bride\r\nCy Dee,Both\r\n");
  const mapping = guessMapping(table.headers);
  const guessed = guessSideMeaning(sideAnswers(table, mapping), { partners: ["Alex", "Sam"] });
  // A partner's name and "both" are read; "Bride" does not say which of them.
  expect(guessed).toEqual({ "Alex's family": "a", Bride: "", Both: "both" });

  const result = planImport(table, mapping, { rsvp: {}, side: { ...guessed, Bride: "b" } }, {});
  expect(result.added.map((g) => g.side)).toEqual(["a", "b", "both"]);
});
