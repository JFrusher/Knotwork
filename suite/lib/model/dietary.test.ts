import { describe, expect, it } from "vitest";
import { dietaryLabel, dietaryMeta, dietaryText, normaliseDietary } from "./dietary";

describe("normaliseDietary", () => {
  it("maps common free-text values to canonical keys", () => {
    expect(normaliseDietary("Vegetarian")).toBe("vegetarian");
    expect(normaliseDietary("V")).toBe("vegetarian");
    expect(normaliseDietary("Vegan")).toBe("vegan");
    expect(normaliseDietary("VG")).toBe("vegan");
    expect(normaliseDietary("Gluten Free")).toBe("gluten-free");
    expect(normaliseDietary("coeliac")).toBe("gluten-free");
    expect(normaliseDietary("Nut allergy")).toBe("nut-allergy");
    expect(normaliseDietary("Nut-Free")).toBe("nut-allergy");
    expect(normaliseDietary("DF")).toBe("dairy-free");
    expect(normaliseDietary("Pescatarian")).toBe("pescatarian");
    expect(normaliseDietary("Halal")).toBe("halal");
  });

  it("treats blank and 'none' values as no requirement", () => {
    expect(normaliseDietary("")).toBe("");
    expect(normaliseDietary(undefined)).toBe("");
    expect(normaliseDietary("none")).toBe("");
    expect(normaliseDietary("None")).toBe("");
    expect(normaliseDietary("N/A")).toBe("");
    expect(normaliseDietary("standard")).toBe("");
  });

  it("falls back to 'other' for unrecognised requirements", () => {
    expect(normaliseDietary("no shellfish please")).toBe("other");
  });

  it("exposes display metadata", () => {
    expect(dietaryMeta("vegan")).toMatchObject({ abbrev: "VG", label: "Vegan" });
    expect(dietaryLabel("gluten-free")).toBe("Gluten-free");
    expect(dietaryMeta("nope")).toBeNull();
  });
});

describe("dietaryText", () => {
  it("prints the guest's own words when they gave some", () => {
    expect(dietaryText({ dietary: "gluten-free", dietaryRaw: "Coeliac — severe" })).toBe("Coeliac — severe");
  });

  it("prints the diet's name when they did not", () => {
    expect(dietaryText({ dietary: "vegan", dietaryRaw: "" })).toBe("Vegan");
  });

  it("prints nothing for no requirement, whatever was typed", () => {
    expect(dietaryText({ dietary: "", dietaryRaw: "None" })).toBe("");
  });
});
