import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { barSum } from "@/lib/bar/sum";
import { withTool } from "@/lib/model/toolbox";
import { drinksEstimate } from "./drinks";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));

describe("the drinks, as Money sees them", () => {
  it("is the Bar's spend on what has a price", () => {
    const doc = migrate(raw);
    expect(drinksEstimate(doc)).toBe(barSum(doc).spend);
    expect(drinksEstimate(doc)).toBeGreaterThan(0);
  });

  it("is nothing when the Bar is hidden", () => {
    expect(drinksEstimate(migrate({ ...raw, tools: withTool(raw, "bar", false) }))).toBeNull();
  });

  it("is nothing when nothing in the Bar has a price", () => {
    const { bar: _bar, ...unpriced } = raw;
    expect(drinksEstimate(migrate(unpriced))).toBeNull();
  });
});
