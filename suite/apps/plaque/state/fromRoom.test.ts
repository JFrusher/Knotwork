import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { ROOM_COLUMNS, roomRows, withMerges } from "./fromRoom";

/**
 * The point of this path is that a card cannot disagree with the seating plan,
 * so what is worth holding is the join: that a guest's table comes out as the
 * label printed on the plan rather than an id, that a seat is the one the plan
 * numbers, and that nobody quietly loses their card for not having a seat yet.
 *
 * Guests are seated as Seating seats them: on the table's own list, which is
 * the record that wins (lib/seating/normalise), and mirrored on the guest.
 */

type Raw = Record<string, Record<string, unknown>>;

const wedding = (guests: Raw, tables: Raw, event: Record<string, unknown> = {}) => {
  const seated: Raw = { ...guests };
  for (const table of Object.values(tables)) {
    for (const id of (table["assignedGuestIds"] as Array<string | null>) ?? []) {
      if (id) seated[id] = { ...seated[id], assignedTableId: table["id"] };
    }
  }
  return migrate({ guests: seated, seating: { tables }, event });
};

describe("printing from the room", () => {
  it("prints the table's label, not its id", () => {
    const doc = wedding(
      { g1: { id: "g1", firstName: "Charis", lastName: "Smith" } },
      { t7: { id: "t7", label: "Top Table", assignedGuestIds: ["g1"] } },
    );

    expect(roomRows(doc).rows[0]).toMatchObject({
      "First Name": "Charis",
      "Last Name": "Smith",
      Name: "Charis Smith",
      Table: "Top Table",
    });
    expect(roomRows(doc).rowIds).toEqual(["g1"]);
  });

  it("numbers a seat only where the table numbers its seats, as the plan stores it", () => {
    const doc = wedding(
      {
        g1: { id: "g1", firstName: "Charis" },
        g2: { id: "g2", firstName: "Tobias" },
        g3: { id: "g3", firstName: "Eleanor" },
      },
      {
        t1: { id: "t1", label: "Table 1", seatMode: "seat", assignedGuestIds: [null, "g1", null, "g2"] },
        t2: { id: "t2", label: "Table 2", seatMode: "table", assignedGuestIds: ["g3"] },
      },
    );
    const seat = Object.fromEntries(roomRows(doc).rows.map((row) => [row["First Name"], row["Seat"]]));
    expect(seat).toEqual({ Charis: "2", Tobias: "4", Eleanor: "" });
  });

  it("numbers tables as people read their labels, and counts who sits at each", () => {
    const doc = wedding(
      { g1: { id: "g1", firstName: "Ann" }, g2: { id: "g2", firstName: "Bo" }, g3: { id: "g3", firstName: "Cy" } },
      {
        a: { id: "a", label: "Table 10", assignedGuestIds: ["g1"] },
        b: { id: "b", label: "Table 2", assignedGuestIds: ["g2", "g3", null] },
      },
    );
    const rows = Object.fromEntries(roomRows(doc).rows.map((row) => [row["First Name"], row]));
    expect(rows["Ann"]).toMatchObject({ "Table Number": "2", "Table Size": "1" });
    expect(rows["Bo"]).toMatchObject({ "Table Number": "1", "Table Size": "2" });
  });

  it("gives each guest the letter a finder files them under", () => {
    const doc = wedding(
      { g1: { id: "g1", firstName: "Charis", lastName: "smith" }, g2: { id: "g2", firstName: "Prince", lastName: "" } },
      {},
    );
    expect(roomRows(doc).rows.map((row) => row["Initial"])).toEqual(["S", "P"]);
  });

  it("carries the name a guest is known by on the stationery, and nothing for one who has none", () => {
    const doc = wedding(
      { g1: { id: "g1", firstName: "Josephine", lastName: "Clarke", knownAs: "Granny Jo" }, g2: { id: "g2", firstName: "Ada", lastName: "Byron" } },
      {},
    );
    expect(roomRows(doc).rows.map((row) => row["Known As"])).toEqual(["", "Granny Jo"]);
  });

  it("prints a side as the partners call it, not the id it is stored under", () => {
    const doc = wedding(
      {
        g1: { id: "g1", firstName: "Charis", side: "a" },
        g2: { id: "g2", firstName: "Tobias", side: "both" },
      },
      {},
      { partners: ["Alex", "Sam"] },
    );
    expect(roomRows(doc).rows.map((row) => row["Side"])).toEqual(["Alex’s side", "Both sides"]);
  });

  it("still prints a card for someone with no table, and says so once", () => {
    const doc = wedding(
      {
        g1: { id: "g1", firstName: "Charis" },
        g2: { id: "g2", firstName: "Tobias" },
        g3: { id: "g3", firstName: "Eleanor" },
      },
      { t1: { id: "t1", label: "Table 1", assignedGuestIds: ["g1"] } },
    );

    const { rows, issues } = roomRows(doc);
    // Three cards, not one. An unseated guest is a job still to do; a card that
    // silently went missing is how somebody arrives to no place at all.
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row["Table"] === "")).toHaveLength(2);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/2 guests have no table/);
  });

  it("prints no card for someone who said they are not coming, nor counts them unseated", () => {
    const doc = wedding(
      {
        g1: { id: "g1", firstName: "Charis" },
        g2: { id: "g2", firstName: "Tobias", rsvpStatus: "declined" },
      },
      { t1: { id: "t1", label: "Table 1", assignedGuestIds: ["g1"] } },
    );
    const { rows, issues } = roomRows(doc);
    expect(rows.map((row) => row["First Name"])).toEqual(["Charis"]);
    expect(issues).toEqual([]);
  });

  it("is read once per wedding, so a screen that asks twice gets the same rows", () => {
    const doc = wedding({ g1: { id: "g1", firstName: "Charis" } }, {});
    expect(roomRows(doc)).toBe(roomRows(doc));
  });

  it("offers the columns a card is actually set from", () => {
    expect(roomRows(wedding({}, {})).headers).toEqual([...ROOM_COLUMNS]);
  });
});

describe("combined cards", () => {
  const doc = wedding(
    {
      g1: { id: "g1", firstName: "Ada", lastName: "Byron" },
      g2: { id: "g2", firstName: "Grace", lastName: "Hopper" },
      g3: { id: "g3", firstName: "Alan", lastName: "Turing" },
    },
    { t4: { id: "t4", label: "Table 4", assignedGuestIds: ["g1", "g2", "g3"] } },
  );

  it("stands in for its people at the first of them", () => {
    const { rows, rowIds } = withMerges(roomRows(doc), { "merged:x": ["g2", "g1"] });
    expect(rowIds).toEqual(["merged:x", "g3"]);
    expect(rows[0]).toMatchObject({ "First Name": "Grace & Ada", Table: "Table 4" });
  });

  it("leaves out somebody no longer on the list, and drops a card with nobody left", () => {
    const { rowIds, rows } = withMerges(roomRows(doc), { "merged:x": ["g1", "gone"], "merged:y": ["gone"] });
    // In name order, as the room lists them: Alan before Grace.
    expect(rowIds).toEqual(["merged:x", "g3", "g2"]);
    expect(rows[0]?.["First Name"]).toBe("Ada");
  });

  it("is the room itself when nobody is combined", () => {
    const room = roomRows(doc);
    expect(withMerges(room, {}).rows).toBe(room.rows);
  });

  it("names everyone on a combined card when one of them is known by a name of their own", () => {
    const doc = wedding(
      { g1: { id: "g1", firstName: "Charis", lastName: "Smith", knownAs: "Granny" }, g2: { id: "g2", firstName: "Eleanor", lastName: "Vane" } },
      {},
    );
    const { rows } = withMerges(roomRows(doc), { "merged:x": ["g1", "g2"] });
    expect(rows.map((row) => row["Known As"])).toEqual(["Granny & Eleanor Vane"]);
  });
});
