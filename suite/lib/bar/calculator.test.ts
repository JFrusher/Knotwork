import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { applyTo } from "@/lib/library/items";
import { emptyBar, readBar } from "@/lib/model/slices";
import { chooseKind, setCrowd, setFigure, setPrice } from "./actions";
import { barHref, calculatorSum, fromCalculator, startingBar } from "./calculator";
import { barSum } from "./sum";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));

const settings = setPrice(setFigure(setCrowd(chooseKind(emptyBar(), "beer-and-wine"), "heavier"), "eveningHours", 5), "white", 7.5);

describe("the drinks calculator", () => {
  it("gives the same figures as the Bar for the same guests and settings", () => {
    const doc = migrate({ ...raw, bar: settings });
    const bar = barSum(doc);
    const calculator = calculatorSum({ ...settings, people: bar.heads.listed });
    expect(calculator.lines).toEqual(bar.lines);
    expect(calculator.spend).toBe(bar.spend);
  });

  it("starts at 100 coming, with every default", () => {
    expect(calculatorSum(startingBar()).heads.people).toBe(100);
  });

  it("carries its settings into the Bar, keeping the wedding's own head count", () => {
    const content = fromCalculator(new URL(barHref({ ...settings, people: 40 }), "https://x.test").hash);
    expect(content).not.toBeNull();
    const doc = migrate({ ...raw, bar: { ...emptyBar(), people: 70 } });
    const [[slice, next]] = applyTo("bar", content!, doc as Record<string, unknown>) as [[string, unknown]];
    const bar = readBar(migrate({ ...raw, [slice]: next }));
    expect(bar).toMatchObject({ kind: "beer-and-wine", crowd: "heavier", people: 70 });
    expect(bar.figures.eveningHours).toBe(5);
    expect(bar.lines.white?.price).toBe(7.5);
  });

  it("ignores an address it did not make", () => {
    expect(fromCalculator("")).toBeNull();
    expect(fromCalculator("#from-calculator=%7Bnot json")).toBeNull();
    expect(fromCalculator("#something-else")).toBeNull();
  });
});
