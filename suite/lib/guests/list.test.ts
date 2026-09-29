// @vitest-environment node
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/trousseau";
import { guestRows, NO_FILTER, shownRows } from "./list";

const doc = migrate({
  guests: {
    g1: { id: "g1", firstName: "Ada", lastName: "Byron", rsvpStatus: "confirmed", side: "a", assignedTableId: "t10", dietary: "vegan", dietaryRaw: "Vegan", tags: ["uni"] },
    g2: { id: "g2", firstName: "Alan", lastName: "Turing", rsvpStatus: "pending", side: "b", assignedTableId: null, plusOneOf: "g1" },
    g3: { id: "g3", firstName: "Grace", lastName: "Hopper", rsvpStatus: "declined", side: "", assignedTableId: "t2" },
    g4: { id: "g4", firstName: "Edsger", lastName: "Dijkstra", rsvpStatus: "confirmed", side: "both", assignedTableId: "t2" },
  },
  seating: {
    tables: {
      t2: { id: "t2", label: "Table 2", assignedGuestIds: ["g3", "g4"] },
      t10: { id: "t10", label: "Table 10", assignedGuestIds: ["g1"] },
    },
  },
});
const rows = guestRows(doc);
const names = (list: ReturnType<typeof shownRows>) => list.map((row) => row.name);

describe("the guest list", () => {
  it("joins each guest to their table, their words about food, and their plus-one", () => {
    const ada = rows.find((row) => row.guest.id === "g1")!;
    expect(ada).toMatchObject({ table: "Table 10", dietary: "Vegan", plusOne: "Brings Alan Turing" });
    expect(rows.find((row) => row.guest.id === "g2")!.plusOne).toBe("Guest of Ada Byron");
  });

  it("sorts tables as numbers, with nobody's table last either way round", () => {
    expect(names(shownRows(rows, NO_FILTER, { key: "table", direction: "ascending" }))).toEqual([
      "Edsger Dijkstra",
      "Grace Hopper",
      "Ada Byron",
      "Alan Turing",
    ]);
    expect(names(shownRows(rows, NO_FILTER, { key: "table", direction: "descending" })).at(-1)).toBe("Alan Turing");
  });

  it("puts replies still to come first", () => {
    expect(names(shownRows(rows, NO_FILTER, { key: "reply", direction: "ascending" }))[0]).toBe("Alan Turing");
  });

  it("filters by reply, table, requirement and text together", () => {
    const sort = { key: "name", direction: "ascending" } as const;
    expect(names(shownRows(rows, { ...NO_FILTER, table: "none" }, sort))).toEqual(["Alan Turing"]);
    expect(names(shownRows(rows, { ...NO_FILTER, table: "t2", reply: "confirmed" }, sort))).toEqual(["Edsger Dijkstra"]);
    expect(names(shownRows(rows, { ...NO_FILTER, dietary: "any" }, sort))).toEqual(["Ada Byron"]);
    expect(names(shownRows(rows, { ...NO_FILTER, text: "uni" }, sort))).toEqual(["Ada Byron"]);
    expect(names(shownRows(rows, { ...NO_FILTER, text: "table 2" }, sort))).toEqual(["Edsger Dijkstra", "Grace Hopper"]);
  });
});
