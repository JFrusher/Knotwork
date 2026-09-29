import { describe, expect, it } from "vitest";
import { emptyBar } from "@/lib/model/slices";
import { chooseKind, choices, resetMix, setFigure, setHave, setPrice, setShare, setShop } from "./actions";
import { figure, mixOf } from "./sum";

describe("the bar's changes", () => {
  it("keeps a changed figure, and forgets one put back or typed at its default", () => {
    const changed = setFigure(emptyBar(), "eveningHours", 5);
    expect(changed.figures).toEqual({ eveningHours: 5 });
    expect(figure(changed, "eveningHours")).toBe(5);
    expect(setFigure(changed, "eveningHours", null).figures).toEqual({});
    expect(setFigure(changed, "eveningHours", 4).figures).toEqual({});
  });

  it("keeps a changed mix whole, and forgets it once it is the kind's again", () => {
    const changed = setShare(emptyBar(), "evening", "spirit", 30);
    expect(changed.mix.evening).toEqual({ fizz: 0, wine: 40, beer: 40, spirit: 30 });
    expect(setShare(changed, "evening", "spirit", 20).mix).toEqual({});
    expect(resetMix(changed, "evening").mix).toEqual({});
  });

  it("pours a new kind's mix, whatever was changed for the old one", () => {
    const changed = setShare(emptyBar(), "evening", "spirit", 30);
    const beerAndWine = chooseKind(changed, "beer-and-wine");
    expect(beerAndWine.mix).toEqual({});
    expect(mixOf(beerAndWine, "evening")).toEqual({ fizz: 0, wine: 50, beer: 50, spirit: 0 });
  });

  it("keeps only the line choices that differ from the line's usual", () => {
    const priced = setPrice(setShop(emptyBar(), "beer", "supermarket"), "beer", 22.5);
    expect(priced.lines).toEqual({ beer: { shop: "supermarket", price: 22.5 } });
    expect(setShop(priced, "beer", "cash-and-carry").lines).toEqual({ beer: { price: 22.5 } });
    expect(setPrice(setShop(priced, "beer", "cash-and-carry"), "beer", null).lines).toEqual({});
    expect(setHave(emptyBar(), "ice", 0).lines).toEqual({});
  });

  it("counts what the couple chose", () => {
    expect(choices(emptyBar())).toBe(0);
    expect(choices(setPrice(setFigure(emptyBar(), "eveningGuests", 40), "fizz", 8))).toBe(2);
  });
});
