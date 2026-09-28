import { describe, expect, it } from "vitest";
import { emptyTrousseau, migrate } from "@jfrusher/trousseau";
import { readiness } from "./readiness";

/**
 * These only fire on the gaps between tools, so what is worth holding is that
 * they stay quiet about anything a single tool already reports — and that they
 * are not so eager they fire on a wedding nobody has started yet.
 */

const wedding = (raw: Record<string, unknown>) => {
  const full = { ...emptyTrousseau(), ...raw };
  return readiness(migrate(full), full);
};

const ids = (raw: Record<string, unknown>) => wedding(raw).map((item) => item.id);

const GUESTS = {
  g1: { id: "g1", firstName: "Charis", lastName: "Smith", assignedTableId: "t1" },
};
const TABLES = { seating: { tables: { t1: { id: "t1", label: "Table 1" } } } };

describe("what is left to do", () => {
  it("asks for a guest list first, and says nothing else", () => {
    // A blank wedding is not a wedding with eight problems.
    expect(ids({})).toEqual(["no-guests"]);
  });

  it("stays quiet on a wedding with nothing wrong", () => {
    expect(ids({ guests: GUESTS, ...TABLES })).toEqual([]);
  });

  it("does not count someone who is not coming as having no table", () => {
    const guests = { ...GUESTS, g2: { id: "g2", firstName: "Tobias", rsvpStatus: "declined" } };
    expect(ids({ guests, ...TABLES })).toEqual([]);
  });

  it("does not mention unseated guests before there are any tables", () => {
    // Nobody is seated on the day the guest list arrives, and saying so then is
    // just restating that the work has not been done yet.
    expect(ids({ guests: { g1: { id: "g1", firstName: "Charis" } } })).toEqual([]);
  });

  describe("place cards against the room", () => {
    const design = (extra: Record<string, unknown>) => ({
      guests: GUESTS,
      ...TABLES,
      stationery: { version: 1, rows: [{}], template: { elements: [] }, ...extra },
    });

    it("objects when the cards come from a file rather than the room", () => {
      expect(ids(design({ fileName: "guests.csv" }))).toContain("cards-from-file");
    });

    it("says nothing when they come from the room", () => {
      expect(ids(design({ fileName: "the room" }))).not.toContain("cards-from-file");
    });

    it("notices a dietary requirement the card cannot show", () => {
      expect(
        ids({
          guests: { g1: { ...GUESTS.g1, dietary: "coeliac" } },
          ...TABLES,
          stationery: { version: 1, fileName: "the room", rows: [{}], template: { elements: [] } },
        }),
      ).toContain("dietary-unprinted");
    });

    it("is satisfied once the card binds the dietary column", () => {
      expect(
        ids({
          guests: { g1: { ...GUESTS.g1, dietary: "coeliac" } },
          ...TABLES,
          stationery: {
            version: 1,
            fileName: "the room",
            rows: [{}],
            template: { elements: [{ text: "{{Name}} · {{Dietary}}" }] },
          },
        }),
      ).not.toContain("dietary-unprinted");
    });

    it("is satisfied by an icon drawn from the dietary column, as Plaque's own design does it", () => {
      expect(
        ids({
          guests: { g1: { ...GUESTS.g1, dietary: "coeliac" } },
          ...TABLES,
          stationery: {
            version: 1,
            fileName: "the room",
            rows: [{}],
            template: { elements: [{ kind: "icon", sourceField: "Dietary", rules: [] }] },
          },
        }),
      ).not.toContain("dietary-unprinted");
    });
  });

  describe("the day against the room", () => {
    const day = (locations: string[], spaces: unknown[]) => ({
      guests: GUESTS,
      seating: { tables: TABLES.seating.tables, room: { spaces } },
      timeline: {
        blocks: locations.map((location, i) => ({ id: `b${i}`, label: `Block ${i}`, location })),
      },
    });

    const BARN = [{ id: "s1", label: "Barn" }];

    it("notices the odd one out once the room's names are in use", () => {
      expect(ids(day(["Barn", "Orangery"], BARN))).toContain("blocks-off-plan");
    });

    it("matches a place however it was capitalised or spaced", () => {
      expect(ids(day(["barn "], BARN))).not.toContain("blocks-off-plan");
    });

    it("says nothing when the day is described in its own words", () => {
      // Nothing here matches the room, so the day simply is not using its
      // vocabulary — which is a choice, not a mistake. A ceremony can be at a
      // church nobody will ever draw a floor plan of.
      expect(ids(day(["Orangery", "Church"], BARN))).not.toContain("blocks-off-plan");
    });

    it("holds its tongue until the room has named parts", () => {
      expect(ids(day(["Orangery"], []))).not.toContain("blocks-off-plan");
    });

    it("asks where a block happens when it does not say", () => {
      expect(ids(day([""], BARN))).toContain("blocks-unplaced");
    });
  });

  it("reports a job with nobody on it as blocking", () => {
    const found = wedding({
      guests: GUESTS,
      ...TABLES,
      crew: { jobs: [{ id: "j1", blockId: "blk-rings", label: "Rings to the best man", personIds: [] }] },
    }).find((item) => item.id === "jobs-uncrewed");

    expect(found?.severity).toBe("blocking");
    expect(found?.href).toBe("/delegation");
  });
});

describe("group shots", () => {
  const shotsWith = (ref: string) => ({
    cast: {},
    sections: [
      {
        id: "s1",
        name: "Family",
        shots: [{ id: "sh1", label: "", members: [{ kind: "guest", ref }], notes: "" }],
      },
    ],
  });

  it("flags a shot that points at a guest who no longer exists", () => {
    expect(ids({ guests: GUESTS, ...TABLES, shots: shotsWith("ghost") })).toContain("shots-dangling");
  });

  it("says nothing when every shot resolves cleanly", () => {
    expect(ids({ guests: GUESTS, ...TABLES, shots: shotsWith("g1") })).not.toContain("shots-dangling");
  });
});

describe("jobs with nobody on them", () => {
  it("counts a job on the day with nobody doing it", () => {
    expect(ids({ guests: GUESTS, crew: { jobs: [{ id: "j1", blockId: "b1", label: "Rings", personIds: [] }] } })).toContain("jobs-uncrewed");
  });

  it("leaves a task off the day alone: with nobody named, it is the couple's own", () => {
    expect(ids({ guests: GUESTS, crew: { jobs: [{ id: "j1", blockId: null, label: "Book the florist", personIds: [] }] } })).not.toContain(
      "jobs-uncrewed",
    );
  });
});

describe("the checklist", () => {
  const on = (today: string, jobs: unknown[]) => {
    const full = { ...emptyTrousseau(), guests: GUESTS, crew: { jobs } };
    return readiness(migrate(full), full, today).find((entry) => entry.id === "tasks-overdue");
  };

  it("nudges about a task past its date", () => {
    expect(on("2028-05-02", [{ id: "j1", blockId: null, label: "Order the cake", dueOn: "2028-05-01", personIds: [] }])).toMatchObject({
      severity: "advisory",
      message: "“Order the cake” was to be done by 1 May 2028.",
      href: "/checklist",
    });
  });

  it("says nothing of one that is done, or not due yet", () => {
    expect(on("2028-05-02", [{ id: "j1", blockId: null, label: "Order the cake", dueOn: "2028-05-01", status: "done" }])).toBeUndefined();
    expect(on("2028-04-30", [{ id: "j1", blockId: null, label: "Order the cake", dueOn: "2028-05-01" }])).toBeUndefined();
  });
});

describe("payments", () => {
  const on = (today: string, balanceDueOn: string, balancePaidOn = "") => {
    const full = {
      ...emptyTrousseau(),
      guests: GUESTS,
      crew: { teams: [{ id: "t1", name: "Granary Kitchen", cost: 9400, deposit: 2000, balanceDueOn, balancePaidOn }] },
    };
    return readiness(migrate(full), full, today);
  };

  it("says a balance falling due within a month is coming", () => {
    const item = on("2028-05-01", "2028-05-18").find((entry) => entry.id === "payments-due");
    expect(item).toMatchObject({ severity: "advisory", href: "/money" });
    expect(item?.message).toBe("Granary Kitchen’s balance of 7,400 is due on 18 May 2028.");
  });

  it("holds an overdue balance up as a problem", () => {
    const item = on("2028-05-19", "2028-05-18").find((entry) => entry.id === "payments-overdue");
    expect(item).toMatchObject({ severity: "blocking", href: "/money" });
    expect(item?.message).toBe("Granary Kitchen’s balance of 7,400 was due on 18 May 2028.");
  });

  it("says nothing of a balance months away, or one already paid", () => {
    expect(on("2027-01-01", "2028-05-18").map((entry) => entry.id)).not.toContain("payments-due");
    expect(on("2028-05-19", "2028-05-18", "2028-05-10").map((entry) => entry.id)).not.toContain("payments-overdue");
  });
});

describe("money and confirmations", () => {
  it("says nothing when there is no budget and nothing committed", () => {
    expect(ids({ guests: GUESTS, crew: { teams: [{ id: "t1", name: "Ushers" }] } })).not.toContain(
      "over-budget",
    );
  });

  it("reports committing more than the budget", () => {
    expect(
      ids({ guests: GUESTS, crew: { budget: 1000, teams: [{ id: "t1", name: "Band", cost: 1400 }] } }),
    ).toContain("over-budget");
  });

  it("stays quiet when the budget still covers it", () => {
    expect(
      ids({ guests: GUESTS, crew: { budget: 2000, teams: [{ id: "t1", name: "Band", cost: 1400 }] } }),
    ).not.toContain("over-budget");
  });

  it("reports a team with jobs that has not confirmed", () => {
    expect(
      ids({
        guests: GUESTS,
        crew: {
          teams: [{ id: "t1", name: "Band" }],
          jobs: [{ id: "j1", label: "Set up", blockId: "b1", teamId: "t1" }],
        },
      }),
    ).toContain("unconfirmed-teams");
  });

  it("stays quiet once they have", () => {
    expect(
      ids({
        guests: GUESTS,
        crew: {
          teams: [{ id: "t1", name: "Band", confirmedOn: "2027-01-04" }],
          jobs: [{ id: "j1", label: "Set up", blockId: "b1", teamId: "t1" }],
        },
      }),
    ).not.toContain("unconfirmed-teams");
  });

  it("ignores a supplier with no jobs — a venue has nothing to confirm", () => {
    expect(
      ids({ guests: GUESTS, crew: { teams: [{ id: "t1", name: "The barn", cost: 6000 }] } }),
    ).not.toContain("unconfirmed-teams");
  });
});
