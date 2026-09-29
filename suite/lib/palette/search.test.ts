// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/trousseau";
import { entries, search } from "./search";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.trousseau.json"), "utf8"));
const all = entries(migrate(raw));

describe("finding anything by name", () => {
  it("offers the pages before anything is typed", () => {
    expect(search(all, "").map((entry) => entry.name)).toEqual([
      "Overview",
      "Guests",
      "Seating",
      "Place cards",
      "Timeline",
      "Delegation",
      "Group shots",
      "Ceremony",
      "Money",
      "Checklist",
      "Binder",
    ]);
  });

  it("does not offer a tool the wedding has removed", () => {
    const pages = entries(migrate({ ...raw, tools: { shown: ["seating"] } }))
      .filter((entry) => entry.kind === "Page")
      .map((entry) => entry.name);
    expect(pages).toEqual(["Overview", "Guests", "Seating"]);
  });

  it("finds a guest and says where they sit, opening the list found to them by id", () => {
    const [zainab] = search(all, "zainab thist");
    expect(zainab).toMatchObject({ kind: "Guest", name: "Zainab Thistlewood", detail: "No table yet" });
    // Their id in the address, never their name.
    expect(zainab!.href).toMatch(/^\/guests\?select=[\w-]+$/);
    expect(zainab!.href).not.toContain("Zainab");
  });

  it("finds a table, a block, a job and a task, each opening where it lives", () => {
    const kinds = (query: string) => search(all, query).map((entry) => `${entry.kind}: ${entry.name} → ${entry.href.replace(/=.*/, "=…")}`);
    expect(kinds("table 13")).toEqual(["Table: Table 13 → /seating?select=…"]);
    expect(kinds("speeches")[0]).toBe("Block: Speeches → /timeline?select=…");
    expect(kinds("lay the tables")).toEqual(["Job: Lay the tables → /delegation?select=…"]);
    expect(kinds("order the cake")).toEqual(["Task: Order the cake → /checklist"]);
  });

  it("puts a name that starts with the query before one that only has it inside", () => {
    const names = search(all, "cake").map((entry) => entry.name);
    expect(names.indexOf("Cake cutting")).toBeLessThan(names.indexOf("Order the cake"));
  });
});
