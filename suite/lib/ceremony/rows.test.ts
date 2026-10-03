import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { nodeFontSource } from "@/apps/brigade/render/pdf/nodeFontSource";
import { textOf } from "@/apps/brigade/render/pdf/readPdf";
import { dayPlaces, readCast, readCeremony, readGuests, readSeating } from "@/lib/model/slices";
import { ceremonyPlace } from "./checks";
import { musicCues } from "./music";
import { renderMusicSheet } from "./render/pdf/musicSheet";
import { renderOrderOfService } from "./render/pdf/orderOfService";
import { renderProcessionalSheet } from "./render/pdf/processionalSheet";
import { renderRunningOrder } from "./render/pdf/runningOrder";
import { orderRows, orderText, processionalRows, processionalText } from "./rows";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
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
    expect(text).toContain(
      "   Music: The Arrival of the Queen of Sheba — George Frideric Handel (String quartet, fade at 2:30). The music changes as the couple enter.",
    );
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

const ceremony = readCeremony(doc);
const { place } = ceremonyPlace(ceremony, dayPlaces(doc));
const order = orderRows(ceremony, readGuests(doc), readSeating(doc), readCast(doc), doc.event, place);

describe("the order of service, read out", () => {
  it("times each part from the ceremony's block, music as guests arrive before it", () => {
    expect(order.map((row) => row.time).slice(0, 4)).toEqual(["Before", "13:30", "13:34", "13:37"]);
    expect(order[3]).toMatchObject({ title: "Sonnet 116, by William Shakespeare", people: ["Jonty Oyelaran"], print: true });
    expect(order[1]!.groups).toHaveLength(6);
    expect(order.some((row) => row.trouble)).toBe(false);
  });

  it("is plain text for the officiant, with the processional where they walk", () => {
    const text = orderText(order, doc.event);
    expect(text).toContain("13:30  2. The processional (4 min)");
    expect(text).toContain("   6) Alex + Sam");
    expect(text).toContain("   Cue: As the registrar brings out the register");
    expect(text).toContain("   Music: Clair de Lune — Claude Debussy (String quartet, from 0:00 to 5:00)");
  });
});

describe("the ceremony, printed", () => {
  it("is a running order for whoever runs the day: times, cues, music and notes, but not the words", async () => {
    const { text } = await textOf(await renderRunningOrder(order, { fontSource: nodeFontSource, coupleNames: "Alex & Sam", officiant: ceremony.officiant, where: place }));
    expect(text).toContain("The running order — Alex & Sam");
    expect(text).toContain("Mrs Ada Hartley, the registrar · 13:30, Orangery");
    expect(text).toContain("Music: Clair de Lune — Claude Debussy — String quartet, from 0:00 to 5:00");
    expect(text).toContain("The best man has them from 13:15");
    expect(text).not.toContain("Let me not to the marriage of true minds");
  });

  it("is a sheet of every piece of music for the players, in the order it plays", async () => {
    const cues = musicCues(ceremony, (id) => processionalRows(ceremony.processional, readGuests(doc), readSeating(doc), readCast(doc), doc.event)[ceremony.processional.findIndex((group) => group.id === id)]!.label);
    expect(cues.map((cue) => cue.song.title)).toEqual([
      "Gymnopédie No. 1",
      "Air on the G String",
      "Canon in D",
      "The Arrival of the Queen of Sheba",
      "The Water Is Wide",
      "Clair de Lune",
      "Here Comes the Sun",
    ]);
    const { text } = await textOf(await renderMusicSheet(cues, { fontSource: nodeFontSource, coupleNames: "Alex & Sam" }));
    expect(text).toContain("The processional — Alex + Sam");
    expect(text).toContain("Cue: The music changes as the couple enter");
  });

  it("is an order of service for the guests, with the words only of what the couple chose to print", async () => {
    const { text } = await textOf(await renderOrderOfService(order, { fontSource: nodeFontSource, event: doc.event, where: place }));
    expect(text).toContain("The marriage of Alex & Sam");
    expect(text).toContain("Let me not to the marriage of true minds");
    expect(text).toContain("The water is wide, I can't cross o'er,");
    // A song that is its own part is named once, with whose it is.
    expect(text).not.toContain("The Water Is Wide — Traditional");
    expect(text).toContain("Traditional");
    expect(text).not.toContain("The best man has them");
    expect(text).not.toContain("13:30");
  });
});
