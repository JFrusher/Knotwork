import { describe, expect, it } from "vitest";
import { emptyBar } from "@/lib/model/slices";
import type { Bar, BarLine } from "@/lib/model/types";
import { chooseKind, setCrowd, setFigure, setHave, setPeople, setPrice, setShare, setWholeCases } from "./actions";
import { sumBar } from "./sum";

const buy = (bar: Bar, listed: number): Record<BarLine, number> =>
  Object.fromEntries(sumBar(bar, listed).lines.map((line) => [line.line, line.buy])) as Record<BarLine, number>;

describe("the bar's sum", () => {
  it("gives the agreed amounts for 100 coming, with every default", () => {
    // The figures agreed with the maintainer, 2026-09-29: a change to a default is seen here.
    expect(buy(emptyBar(), 100)).toEqual({ fizz: 42, white: 36, red: 36, beer: 216, spirits: 3, mixers: 10, soft: 50, ice: 100 });
    const { heads, each } = sumBar(emptyBar(), 100);
    expect(heads).toEqual({ listed: 100, people: 100, typed: false, evening: 0, drinking: 80, notDrinking: 20 });
    expect(each).toEqual({ reception: 3, toast: 1, meal: 2, evening: 4 });
  });

  it("buys single bottles rather than whole cases when not on sale or return", () => {
    const loose = buy(setWholeCases(emptyBar(), false), 100);
    expect(loose).toMatchObject({ fizz: 42, white: 34, red: 34, beer: 200 });
  });

  it("takes off what they already have before rounding up to a case", () => {
    // 41.3 bottles of fizz, 5 in the cupboard: 36.3 to buy, 37, a case of six makes 42.
    expect(buy(setHave(emptyBar(), "fizz", 5), 100).fizz).toBe(42);
    expect(buy(setHave(setWholeCases(emptyBar(), false), "fizz", 5), 100).fizz).toBe(37);
    expect(buy(setHave(emptyBar(), "ice", 500), 100).ice).toBe(0);
  });

  it("reads a typed count over the guest list's, and says so", () => {
    const sum = sumBar(setPeople(emptyBar(), 50), 100);
    expect(sum.heads).toMatchObject({ listed: 100, people: 50, typed: true });
    expect(sum.lines.find((line) => line.line === "ice")!.needed).toBe(50);
  });

  it("buys for evening-only guests in the evening, and nothing earlier", () => {
    const withEvening = setFigure(setWholeCases(emptyBar(), false), "eveningGuests", 50);
    const day = sumBar(setWholeCases(emptyBar(), false), 100).lines;
    const both = sumBar(withEvening, 100).lines;
    const beer = (lines: typeof day) => lines.find((line) => line.line === "beer")!.needed;
    // 40 more drinking, four drinks each in the evening, 40% of them beer.
    expect(beer(both) - beer(day)).toBeCloseTo(40 * 4 * 0.4);
    const fizz = (lines: typeof day) => lines.find((line) => line.line === "fizz")!.needed;
    expect(fizz(both)).toBeCloseTo(fizz(day));
  });

  it("puts a fifth on for a heavier crowd, but never on the toast", () => {
    const { each } = sumBar(setCrowd(emptyBar(), "heavier"), 100);
    expect(each.reception).toBeCloseTo(3.6);
    expect(each.toast).toBe(1);
    expect(each.meal).toBeCloseTo(2.4);
  });

  it("pours what the kind of bar pours", () => {
    const beerAndWine = buy(chooseKind(emptyBar(), "beer-and-wine"), 100);
    expect(beerAndWine.spirits).toBe(0);
    expect(beerAndWine.mixers).toBe(0);
    const cocktails = sumBar(chooseKind(emptyBar(), "cocktails"), 100).lines;
    // Only the toast is fizz: 80 glasses, 13.3 bottles.
    expect(cocktails.find((line) => line.line === "fizz")!.needed).toBeCloseTo(80 / 6);
  });

  it("names every drink alcohol-free at a no and low bar", () => {
    const names = sumBar(chooseKind(emptyBar(), "no-and-low"), 100).lines.map((line) => line.name);
    expect(names).toEqual([
      "Alcohol-free fizz",
      "Alcohol-free white wine",
      "Alcohol-free red wine",
      "Alcohol-free beer",
      "Alcohol-free spirits",
      "Mixers",
      "Soft drinks",
      "Ice",
    ]);
  });

  it("reads a mix as shares of what it adds up to", () => {
    // Reception at 70 fizz and 70 beer is half and half, not 140%.
    const even = setShare(emptyBar(), "reception", "beer", 70);
    const lines = sumBar(setWholeCases(even, false), 100).lines;
    // Reception: 240 drinks, 120 of them beer; evening: 128 beer.
    expect(lines.find((line) => line.line === "beer")!.needed).toBeCloseTo(248);
  });

  it("pours nothing in a part whose mix is all nothing", () => {
    const none = (["fizz", "beer"] as const).reduce((bar, pour) => setShare(bar, "reception", pour, 0), emptyBar());
    const lines = sumBar(none, 100).lines;
    // The toast is all the fizz left.
    expect(lines.find((line) => line.line === "fizz")!.needed).toBeCloseTo(80 / 6);
  });

  it("prices a case of beer whole, and leaves unpriced lines out of the spend", () => {
    const priced = setPrice(setPrice(emptyBar(), "beer", 24), "fizz", 8);
    const sum = sumBar(priced, 100);
    expect(sum.lines.find((line) => line.line === "beer")!.cost).toBe(216);
    expect(sum.spend).toBe(216 + 42 * 8);
    expect(sum.unpriced).toBe(6);
  });

  it("buys nothing for nobody", () => {
    expect(Object.values(buy(emptyBar(), 0)).every((n) => n === 0)).toBe(true);
    expect(sumBar(emptyBar(), 0).unpriced).toBe(0);
  });
});
