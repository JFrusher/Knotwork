import { expect, test } from "vitest";
import { removeGuests } from "./removeGuests";

const seating = {
  tables: {
    t1: { id: "t1", seatMode: "seat", assignedGuestIds: ["a", "b", null], perSideSeats: { top: 2 } },
    t2: { id: "t2", seatMode: "table", assignedGuestIds: ["c", "a"] },
  },
  groups: { g: { id: "g", name: "College", memberIds: ["a", "c"] } },
  families: { f: { id: "f", name: "Smiths", memberIds: ["a", "b"] } },
  constraints: [
    { id: "r1", kind: "apart", guestIds: ["a", "c"] },
    { id: "r2", kind: "together", guestIds: ["b", "c"] },
  ],
  somethingOnlySeatingKnows: { kept: true },
};
const guests = {
  a: { id: "a", firstName: "Ann" },
  b: { id: "b", firstName: "Bo" },
  c: { id: "c", firstName: "Cy", plusOneOf: "a" },
};

test("a removed guest leaves every table, group, family and rule they were in", () => {
  const out = removeGuests(guests, seating, new Set(["a"]));

  expect(Object.keys(out.guests)).toEqual(["b", "c"]);
  const tables = out.seating["tables"] as Record<string, { assignedGuestIds: unknown[] }>;
  // Seat mode keeps the hole; table mode closes up.
  expect(tables["t1"]!.assignedGuestIds).toEqual([null, "b", null]);
  expect(tables["t2"]!.assignedGuestIds).toEqual(["c"]);
  expect((out.seating["groups"] as Record<string, { memberIds: string[] }>)["g"]!.memberIds).toEqual(["c"]);
  expect((out.seating["families"] as Record<string, { memberIds: string[] }>)["f"]!.memberIds).toEqual(["b"]);
  expect((out.seating["constraints"] as Array<{ id: string }>).map((r) => r.id)).toEqual(["r2"]);
});

test("someone who was their plus-one is kept, with the link cleared", () => {
  const out = removeGuests(guests, seating, new Set(["a"]));
  expect(out.guests["c"]).toEqual({ id: "c", firstName: "Cy", plusOneOf: null });
});

test("everything else in the seating is copied as it was", () => {
  const out = removeGuests(guests, seating, new Set(["a"]));
  expect(out.seating["somethingOnlySeatingKnows"]).toEqual({ kept: true });
  expect((out.seating["tables"] as Record<string, Record<string, unknown>>)["t1"]!["perSideSeats"]).toEqual({ top: 2 });
});
