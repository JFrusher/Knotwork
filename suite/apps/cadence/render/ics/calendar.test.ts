import { describe, expect, it } from "vitest";
import { emptyDoc } from "../../core/model/defaults";
import type { Block, TimelineDoc } from "../../core/model/types";
import { calendar, escapeText, fold } from "./calendar";

function block(id: string, label: string, anchorMin: number, durationMin: number, extra: Partial<Block> = {}): Block {
  return { id, label, durationMin, anchorMin, gapMin: 0, bufferMin: 0, lane: "Main day", tags: [], location: "", notes: "", outputs: [], ...extra };
}

const doc: TimelineDoc = {
  ...emptyDoc(),
  day: { ...emptyDoc().day, coupleNames: "Alex & Sam" },
  blocks: [
    block("blk-ceremony", "Ceremony", 13 * 60 + 30, 45, { location: "Orangery", tags: ["registrar", "photographer"], bufferMin: 10 }),
    block("blk-rings", "Rings to the best man", 13 * 60 + 15, 0, { location: "Orangery", tags: ["registrar"] }),
    block("blk-carriages", "Carriages", 24 * 60 + 40, 20, { location: "Front drive" }),
  ],
  tagDetails: [{ tag: "registrar", displayName: "County Registrar" }],
};

const NOW = new Date("2028-05-01T09:08:07.123Z");
const make = (tag?: string) => calendar(doc, { date: "2028-06-01", now: NOW, ...(tag === undefined ? {} : { tag }) });
const lines = (ics: string) => ics.split("\r\n");
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("the day as a calendar", () => {
  it("is a calendar of the day's blocks in time order, every line ended with CRLF", () => {
    const ics = make();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(lines(ics).filter((line) => line.startsWith("SUMMARY:"))).toEqual([
      "SUMMARY:Rings to the best man",
      "SUMMARY:Ceremony",
      "SUMMARY:Carriages",
    ]);
    expect(ics).toContain("X-WR-CALNAME:Alex & Sam\r\n");
  });

  it("writes the venue's clock, ends a block where the run sheet does, and puts past midnight on the next day", () => {
    const ics = make();
    // The ceremony's ten-minute buffer is contingency, not the ceremony.
    expect(ics).toContain("DTSTART:20280601T133000\r\nDTEND:20280601T141500\r\n");
    expect(ics).toContain("DTSTART:20280602T004000\r\nDTEND:20280602T010000\r\n");
    expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  it("gives a moment a start and no end", () => {
    const rings = unfold(make()).split("BEGIN:VEVENT")[1]!;
    expect(rings).toContain("DTSTART:20280601T131500");
    expect(rings).not.toContain("DTEND");
  });

  it("gives each event a stamp and an id that is stable, and particular to this wedding", () => {
    const ics = make();
    expect(ics).toContain("UID:blk-ceremony.2028-06-01.alex-and-sam@trousseau\r\n");
    expect(ics).toContain("DTSTAMP:20280501T090807Z\r\n");
    expect(make()).toBe(ics);
  });

  it("gives one tag its own blocks, under its name", () => {
    const ics = make("registrar");
    expect(lines(ics).filter((line) => line.startsWith("SUMMARY:"))).toEqual(["SUMMARY:Rings to the best man", "SUMMARY:Ceremony"]);
    expect(ics).toContain("X-WR-CALNAME:Alex & Sam — County Registrar\r\n");
  });

  it("refuses a day without the wedding's date rather than inventing one", () => {
    expect(() => calendar(doc, { date: "", now: NOW })).toThrow("the wedding's date");
  });
});

describe("calendar text", () => {
  it("escapes what the format reserves", () => {
    expect(escapeText("Drinks; canapés, and a toast\\speech\nthen dinner")).toBe("Drinks\\; canapés\\, and a toast\\\\speech\\nthen dinner");
  });

  it("folds at 75 octets without splitting a character, and unfolds to what it was", () => {
    const line = `DESCRIPTION:${"Rosé and café — ".repeat(12)}`;
    const folded = fold(line);
    for (const physical of folded.split("\r\n")) expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((physical) => physical.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("leaves a short line alone", () => {
    expect(fold("SUMMARY:Ceremony")).toBe("SUMMARY:Ceremony");
  });
});
