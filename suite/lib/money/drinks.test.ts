import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { barSum } from "@/lib/bar/sum";
import { withTool } from "@/lib/model/toolbox";
import { drinksEstimate } from "./drinks";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));

describe("the drinks estimate on the Money page", () => {
  it("is the Bar's spend for what has a price", () => {
    const doc = migrate(raw);
    expect(drinksEstimate(doc)).toBe(barSum(doc).spend);
    expect(drinksEstimate(doc)).toBeGreaterThan(0);
  });

  it("is nothing when the Bar is hidden", () => {
    expect(drinksEstimate(migrate({ ...raw, tools: withTool(raw, "bar", false) }))).toBeNull();
  });

  it("is nothing when nothing in the Bar has a price", () => {
    const lines = { spirits: { have: 2 } };
    expect(drinksEstimate(migrate({ ...raw, bar: { ...raw.bar, lines } }))).toBeNull();
  });
});
