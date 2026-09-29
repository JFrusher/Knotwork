// @vitest-environment node
import { describe, expect, it } from "vitest";
import { changeBudget, changeTeam } from "./edit";

const crew = {
  teams: [
    { id: "t1", name: "Band", cost: 2200, ownedByDelegation: "kept" },
    { id: "t2", name: "Florist", cost: 1250 },
  ],
  people: [{ id: "p1", name: "Rosa" }],
  jobs: [{ id: "j1", label: "Flowers" }],
  budget: 24000,
};

describe("changing money", () => {
  it("changes one team's money and copies everything else", () => {
    const next = changeTeam(crew, "t1", { balancePaidOn: "2028-05-01" });
    expect(next["teams"]).toEqual([
      { id: "t1", name: "Band", cost: 2200, ownedByDelegation: "kept", balancePaidOn: "2028-05-01" },
      { id: "t2", name: "Florist", cost: 1250 },
    ]);
    expect(next["people"]).toBe(crew.people);
    expect(next["jobs"]).toBe(crew.jobs);
  });

  it("refuses a team that is not there, rather than saving nothing", () => {
    expect(() => changeTeam(crew, "t9", { cost: 1 })).toThrow("No team t9");
  });

  it("sets the budget, or clears it", () => {
    expect(changeBudget(crew, null)).toMatchObject({ budget: null, teams: crew.teams });
  });
});
