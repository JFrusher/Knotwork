import { describe, expect, it } from "vitest";
import { coupleTitle, partnerNames, roleLabel, sideLabel, sideShort, splitTitle } from "./partners";

const alexAndSam = { partners: ["Alex", "Sam"] as [string, string] };

describe("naming things after the partners", () => {
  it("calls each side after its partner", () => {
    expect(sideLabel("a", alexAndSam)).toBe("Alex’s side");
    expect(sideLabel("b", alexAndSam)).toBe("Sam’s side");
    expect(sideLabel("both", alexAndSam)).toBe("Both sides");
    expect(sideLabel("", alexAndSam)).toBe("");
    expect(sideShort("b", alexAndSam)).toBe("Sam’s");
  });

  it("writes a name ending in s the way it is said", () => {
    expect(sideLabel("a", { partners: ["James", "Sam"] })).toBe("James’ side");
  });

  it("names each group-shot role after its partner", () => {
    expect(roleLabel("a", alexAndSam)).toBe("Alex");
    expect(roleLabel("b-mother", alexAndSam)).toBe("Sam’s mother");
    expect(roleLabel("a-father", alexAndSam)).toBe("Alex’s father");
    expect(roleLabel("b-party", alexAndSam)).toBe("Sam’s wedding party");
  });

  it("says who a partner is before they are named", () => {
    expect(partnerNames({ partners: ["", ""] })).toEqual(["Partner one", "Partner two"]);
    expect(sideLabel("b", { partners: ["Alex", ""] })).toBe("Partner two’s side");
  });

  it("titles the wedding from the two names", () => {
    expect(coupleTitle(["Alex", "Sam"])).toBe("Alex & Sam");
    expect(coupleTitle(["Alex", ""])).toBe("Alex");
    expect(coupleTitle(["", ""])).toBe("");
  });

  it("finds two names in a title written the old way, and guesses at nothing else", () => {
    expect(splitTitle("Charis & Jacob")).toEqual(["Charis", "Jacob"]);
    expect(splitTitle("Alex and Sam")).toEqual(["Alex", "Sam"]);
    expect(splitTitle("The Smiths")).toBeNull();
    expect(splitTitle("A & B & C")).toBeNull();
  });
});
