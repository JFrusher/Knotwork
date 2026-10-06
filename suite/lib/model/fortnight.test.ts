import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { withTool } from "./toolbox";
import { fortnight } from "./fortnight";

// The example's day is 1 June 2028.
const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const doc = migrate(raw);

describe("the last fortnight's card", () => {
  it("appears 13 days out, and not 15", () => {
    expect(fortnight(doc, raw, "2028-05-19")?.days).toBe(13);
    expect(fortnight(doc, raw, "2028-05-17")).toBeNull();
  });

  it("stays until the day, and goes after it", () => {
    expect(fortnight(doc, raw, "2028-06-01")?.days).toBe(0);
    expect(fortnight(doc, raw, "2028-06-02")).toBeNull();
  });

  it("is nothing without a date", () => {
    const undated = { ...raw, event: { ...raw.event, date: "" } };
    expect(fortnight(migrate(undated), undated, "2028-05-19")).toBeNull();
  });

  it("lists what to print, each opening the tool or export that makes it", () => {
    expect(fortnight(doc, raw, "2028-05-19")!.print).toEqual([
      { label: "The wedding pack: every PDF for the day in one", href: "/#wedding-pack" },
      { label: "Place cards", href: "/stationery?piece=place-cards" },
      { label: "Table cards", href: "/stationery?piece=table-card" },
      { label: "A job sheet for each person", href: "/delegation" },
      { label: "The shot list", href: "/group-shots" },
    ]);
  });

  it("leaves out what a hidden tool would print", () => {
    const once = { ...raw, tools: withTool(raw, "group-shots", false) };
    const r = { ...once, tools: withTool(once, "delegation", false) };
    expect(fortnight(migrate(r), r, "2028-05-19")!.print.map((p) => p.href)).toEqual([
      "/#wedding-pack",
      "/stationery?piece=place-cards",
      "/stationery?piece=table-card",
    ]);
  });

  it("names what is still open that would show on paper, and nothing else", () => {
    const open = fortnight(doc, raw, "2028-05-19")!.open.map((item) => item.id);
    expect(open).toContain("unseated");
    expect(open).not.toContain("tasks-overdue");
    expect(open).not.toContain("unconfirmed-teams");
  });
});

describe("what would print wrong", () => {
  it("includes a ceremony or a box whose part of the day has gone", () => {
    const blocks = raw.timeline.blocks.filter((b: { id: string }) => b.id !== "blk-ceremony");
    const r = { ...raw, timeline: { ...raw.timeline, blocks } };
    const open = fortnight(migrate(r), r, "2028-05-19")!.open.map((item) => item.id);
    expect(open).toContain("ceremony-lost");
    expect(open).toContain("boxes-lost");
  });
});
