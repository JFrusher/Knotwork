// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { helperSheet } from "./helperSheet";

type Raw = Record<string, any>;
const fixture = () => JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8")) as Raw;
const raw = fixture();
const doc = migrate(raw);
const person = (name: string) => (raw.crew.people as Array<{ id: string; name: string }>).find((entry) => entry.name === name)!.id;

describe("a helper's sheet", () => {
  it("never holds a dietary need, a guest's email or a note, for anyone in the crew", () => {
    // The example wedding has dietary needs on every guest but no emails or
    // notes: plant those, and a need of one crew member's own that nothing
    // else would ever print, so each check has something to find.
    const planted = fixture();
    for (const guest of Object.values(planted.guests) as Raw[]) {
      guest.email = `${guest.id}@guests.example`;
      guest.notes = "PLANTED guest note";
    }
    const rafferty = (planted.crew.people as Raw[]).find((entry) => entry.name === "Rafferty Sørensen")!;
    planted.guests[rafferty.guestId].dietaryRaw = "PLANTED anaphylaxis to sesame";
    for (const job of planted.crew.jobs as Raw[]) job.notes = "PLANTED job note";
    for (const entry of [...planted.crew.people, ...planted.crew.teams] as Raw[]) entry.notes = "PLANTED crew note";
    const plantedDoc = migrate(planted);

    const needs = new Set(
      (Object.values(planted.guests) as Raw[]).flatMap((guest) => [guest.dietaryRaw, guest.dietary]).filter((need: string) => need && need !== "None"),
    );
    expect(needs.size).toBeGreaterThan(5);

    for (const { id, name } of planted.crew.people as Raw[]) {
      const text = JSON.stringify(helperSheet(plantedDoc, id)).toLowerCase();
      expect(text, name).toContain(name.toLowerCase());
      expect(text, name).not.toContain("@guests.example");
      expect(text, name).not.toContain("planted");
      for (const need of needs) expect(text, `${name}: ${need}`).not.toContain(String(need).toLowerCase());
    }
  });

  it("has the day, their own jobs and their team's, the boxes, the shots with names, and the crew's numbers", () => {
    const maya = helperSheet(doc, person("Maya Ivers"))!;
    expect(maya.wedding).toEqual({ names: "Alex & Sam", date: "2028-06-01", venue: "The Old Granary" });
    expect(maya.helper).toEqual({ name: "Maya Ivers", team: "Eleanor Vane Photography" });
    expect(maya.day).toHaveLength(27);
    // Hers, given to her team.
    expect(maya.jobs).toEqual([{ label: "Photograph the ceremony", when: "13:30–14:15", where: "Orangery", who: ["Eleanor Vane Photography", "Maya Ivers"] }]);
    expect(maya.boxes.map((box) => box.name)).toContain("The rings and the paperwork");
    expect(maya.shots.flatMap((section) => section.shots)[0]).toEqual({ label: "The couple, alone", names: ["Alex Morgan", "Sam Reyes"] });
    expect(maya.crew).toContainEqual({ name: "Eleanor Vane Photography", role: "photographer", phone: "07700 900141" });

    const rafferty = helperSheet(doc, person("Rafferty Sørensen"))!;
    expect(rafferty.jobs.map((job) => job.label)).toEqual(expect.arrayContaining(["Bring the rings", "Round up each group for the photos"]));
    expect(rafferty.jobs.map((job) => job.label)).not.toContain("Photograph the ceremony");
  });

  it("is nothing for someone no longer in the crew", () => {
    expect(helperSheet(doc, "per-gone")).toBeNull();
  });

  it("leaves out the boxes and the shots of a wedding that has those tools hidden", () => {
    const hidden = fixture();
    hidden.tools.shown = (hidden.tools.shown as string[]).filter((id) => id !== "boxes" && id !== "group-shots");
    const sheet = helperSheet(migrate(hidden), person("Maya Ivers"))!;
    expect(sheet.boxes).toEqual([]);
    expect(sheet.shots).toEqual([]);
  });
});
