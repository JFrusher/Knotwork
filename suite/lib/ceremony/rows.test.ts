import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/trousseau";
import { nodeFontSource } from "@/apps/brigade/render/pdf/nodeFontSource";
import { textOf } from "@/apps/brigade/render/pdf/readPdf";
import { readCast, readCeremony, readGuests, readSeating } from "@/lib/model/slices";
import { renderProcessionalSheet } from "./render/pdf/processionalSheet";
import { processionalRows, processionalText } from "./rows";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.trousseau.json"), "utf8"));
const doc = migrate(raw);
const rows = processionalRows(readCeremony(doc).processional, readGuests(doc), readSeating(doc), readCast(doc), doc.event);

describe("the processional, read out", () => {
  it("names each group, who is in it, how they walk and to which side", () => {
    expect(rows[0]).toMatchObject({ number: 1, label: "The registrar", people: [], how: "One at a time", cue: "In place before the music starts" });
    expect(rows[1]!.label).toBe("Alex’s mother + Alex’s father");
    expect(rows[1]!.people).toHaveLength(2);
    expect(rows[1]!.how).toBe("In pairs, to Alex’s side");
    expect(rows.some((row) => row.trouble)).toBe(false);
  });

  it("is plain text to paste into an email, in order", () => {
    const text = processionalText(rows, doc.event);
    expect(text.split("\n").slice(0, 5)).toEqual([
      "The processional — Alex & Sam",
      "",
      "1. The registrar",
      "   One at a time.",
      "   In place before the music starts.",
    ]);
    expect(text).toContain("6. Alex + Sam");
    expect(text).toContain("   Music: The Arrival of the Queen of Sheba. The music changes as the couple enter.");
  });
});

describe("the processional, printed", () => {
  it("is one page for the officiant, with every group on it", async () => {
    const { text, pages } = await textOf(await renderProcessionalSheet(rows, { fontSource: nodeFontSource, coupleNames: "Alex & Sam" }));
    expect(pages).toBe(1);
    expect(text).toContain("The processional — Alex & Sam");
    for (const row of rows) expect(text).toContain(row.label);
    expect(text).toContain("Canon in D");
  });
});
