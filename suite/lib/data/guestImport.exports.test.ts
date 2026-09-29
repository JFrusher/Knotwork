import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseCsv } from "./csv";
import { guessMapping, guessRsvpMeaning, planImport, rsvpAnswers } from "./guestImport";

/**
 * Exports shaped after what Joy and Zola document their guest-list exports to
 * contain — Zola: one Name column, Email, Phone, RSVP Status, Meal Choice,
 * Notes; Joy: first and last names, Email, Party, and one column per RSVP
 * question. Not real exports: the hosts were not reachable from where these
 * were written. Replace each with a real file when one is to hand. There is no
 * The Knot fixture, because its export's columns are not documented anywhere
 * that could be checked.
 */
const fixture = (name: string) =>
  // Relative to the suite, where the tests run from.
  parseCsv(readFileSync(join(process.cwd(), "fixtures", name), "utf8"));

test("a Joy-shaped export: names, email, attending, meal and diet are all found", () => {
  const table = fixture("joy-shaped.csv");
  const mapping = guessMapping(table.headers);
  expect(mapping).toMatchObject({
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    rsvp: "Attending",
    entree: "Meal Choice",
    dietary: "Dietary Restrictions",
  });
  // Joy's Party is the household invited together, not whose side they are on.
  expect(mapping.side).toBeNull();

  const plan = planImport(table, mapping, { rsvp: guessRsvpMeaning(rsvpAnswers(table, mapping)), side: {} }, {});
  expect(plan.added.map((g) => [g.firstName, g.rsvpStatus, g.dietary])).toEqual([
    ["Beatrix", "confirmed", "vegetarian"],
    ["Otto", "confirmed", ""],
    ["Priya", "declined", ""],
    ["Devendra", "pending", "gluten-free"],
  ]);
  expect(plan.added[3]!.dietaryRaw).toBe("Coeliac - severe");
});

test("a Zola-shaped export: one name column, RSVP status and meal are found", () => {
  const table = fixture("zola-shaped.csv");
  const mapping = guessMapping(table.headers);
  expect(mapping).toMatchObject({ fullName: "Name", email: "Email", rsvp: "RSVP Status", entree: "Meal Choice", notes: "Notes" });

  const plan = planImport(table, mapping, { rsvp: guessRsvpMeaning(rsvpAnswers(table, mapping)), side: {} }, {});
  expect(plan.added.map((g) => [g.firstName, g.lastName, g.rsvpStatus, g.entree])).toEqual([
    ["Beatrix", "Lindqvist", "confirmed", "Risotto"],
    ["Otto", "Lindqvist", "confirmed", "Beef"],
    ["Priya", "Castellanos", "declined", ""],
    ["Devendra", "Raghunathan", "pending", ""],
  ]);
});

test("the same people from Joy then Zola are updated, not doubled", () => {
  const joy = fixture("joy-shaped.csv");
  const joyMapping = guessMapping(joy.headers);
  const first = planImport(joy, joyMapping, { rsvp: guessRsvpMeaning(rsvpAnswers(joy, joyMapping)), side: {} }, {});
  const zola = fixture("zola-shaped.csv");
  const mapping = guessMapping(zola.headers);
  const second = planImport(zola, mapping, { rsvp: guessRsvpMeaning(rsvpAnswers(zola, mapping)), side: {} }, first.guests);
  expect(second.added).toHaveLength(0);
  expect(Object.keys(second.guests)).toHaveLength(4);
});
