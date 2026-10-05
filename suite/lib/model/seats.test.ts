import { describe, expect, test } from "vitest";
import { newTable } from "./factories";
import { seatsOf } from "./seats";

describe("the order tables are read in", () => {
  const seating = (...tables: ReturnType<typeof newTable>[]) => ({ tables: Object.fromEntries(tables.map((t) => [t.id, t])) }) as never;

  test("as people read their names: 2 before 10", () => {
    const seats = seatsOf(
      seating(newTable({ id: "a", label: "Table 10", assignedGuestIds: ["g10"] }), newTable({ id: "b", label: "Table 2", assignedGuestIds: ["g2"] })),
    );
    expect(seats.get("g2")!.tableNumber).toBe(1);
    expect(seats.get("g10")!.tableNumber).toBe(2);
  });

  test("the top table first, whatever it is called, by its type or by what it is for", () => {
    const seats = seatsOf(
      seating(
        newTable({ id: "a", label: "Table 1", assignedGuestIds: ["g1"] }),
        newTable({ id: "b", label: "Top table", type: "top-table", assignedGuestIds: ["top"] }),
        newTable({ id: "c", label: "Rose", designation: "top-table", assignedGuestIds: ["rose"] }),
      ),
    );
    expect(["rose", "top", "g1"].map((id) => seats.get(id)!.tableNumber)).toEqual([1, 2, 3]);
  });
});
