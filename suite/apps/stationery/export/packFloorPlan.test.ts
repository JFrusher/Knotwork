import { describe, expect, it } from "vitest";
import { GALLERY } from "../core/data/gallery";
import { ELEMENT_KINDS } from "../core/template/registry";
import { initialSuite, newPiece } from "../state/design";
import { packFloorPlan } from "./packFloorPlan";

describe("the floor plan the wedding pack prints", () => {
  const card = { widthMm: 90, heightMm: 55, fold: "none", foldPositionMm: 0, invertBackPanel: false, bleedMm: 0 } as const;
  const map = ELEMENT_KINDS.find((k) => k.kind === "room")!.create({ id: "map", z: 1, card, headers: [] });

  it("is not an escort card that happens to carry a map of the room", () => {
    const suite = initialSuite();
    suite.pieces[0]!.template = { ...suite.pieces[0]!.template, elements: [map] };
    expect(packFloorPlan(suite, []).name).toBe("Floor plan");
    expect(packFloorPlan(suite, []).template.rowScope).toEqual({ kind: "document" });
  });

  it("is the wedding's own whole-list plan when it has one", () => {
    const suite = initialSuite();
    const plan = { ...newPiece("our-plan", "Our plan"), template: { ...GALLERY.find((g) => g.id === "floor-plan")!.template } };
    suite.pieces.push(plan);
    expect(packFloorPlan(suite, []).name).toBe("Our plan");
  });
});
