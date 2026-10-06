// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Crew, Team } from "@/lib/model/types";
import { money } from "./money";

const team = (id: string, over: Partial<Team>): Team => ({
  id,
  tag: null,
  name: id,
  phone: "",
  notes: "",
  email: "",
  cost: null,
  deposit: null,
  depositPaidOn: "",
  balanceDueOn: "",
  balancePaidOn: "",
  confirmedOn: "",
  ...over,
});

const crew = (teams: Team[], budget: number | null = null): Crew => ({ teams, people: [], jobs: [], budget, errandsDone: [] });

describe("money", () => {
  it("adds up what is committed, paid and still to pay", () => {
    const found = money(
      crew(
        [
          team("Caterer", { cost: 9400, deposit: 2000, depositPaidOn: "2027-10-02", balanceDueOn: "2028-05-18" }),
          team("Registrar", { cost: 575, deposit: 575, depositPaidOn: "2027-08-01" }),
          team("Band", { cost: 2200, deposit: 500, balanceDueOn: "2028-05-30", balancePaidOn: "2028-05-01" }),
          team("Ushers", {}),
        ],
        24000,
      ),
    );
    expect(found).toMatchObject({ committed: 12175, paid: 2000 + 575 + 1700, owed: 12175 - 4275, left: 11825 });
    // Friends doing a job, with no money agreed, are not suppliers.
    expect(found.suppliers.map((s) => s.team.name)).toEqual(["Caterer", "Registrar", "Band"]);
    expect(found.suppliers[0]).toMatchObject({ balance: 7400, paid: 2000, owed: 7400 });
  });

  it("lists what is still to pay, soonest first, and a deposit with no date last", () => {
    const found = money(
      crew([
        team("Band", { cost: 2200, deposit: 500, balanceDueOn: "2028-05-30" }),
        team("Caterer", { cost: 9400, deposit: 2000, depositPaidOn: "2027-10-02", balanceDueOn: "2028-05-18" }),
        team("Registrar", { cost: 575, deposit: 575, depositPaidOn: "2027-08-01" }),
      ]),
    );
    expect(found.toPay.map((p) => `${p.team} ${p.kind} ${p.amount} ${p.dueOn}`)).toEqual([
      "Caterer balance 7400 2028-05-18",
      "Band balance 1700 2028-05-30",
      "Band deposit 500 ",
    ]);
  });

  it("says a budget is overspent as a negative left", () => {
    expect(money(crew([team("Band", { cost: 1400 })], 1000)).left).toBe(-400);
  });
});
