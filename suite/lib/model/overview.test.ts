// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/trousseau";
import { overview, type AreaId } from "./overview";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.trousseau.json"), "utf8"));
const byId = (areas: ReturnType<typeof overview>) =>
  Object.fromEntries(areas.map((area) => [area.id, area])) as Record<AreaId, (typeof areas)[number]>;

describe("the front page's measures", () => {
  it("says how far along each part of the example wedding is", () => {
    const areas = byId(overview(migrate(raw), raw));

    expect(areas.guests).toMatchObject({ summary: "106 guests", detail: "95 said yes · 5 yet to reply · 6 said no" });
    expect(areas.guests.progress).toBeCloseTo(101 / 106);
    expect(areas.money).toMatchObject({ summary: "15,865 of 24,000", detail: "3,325 paid · 12,540 to pay" });
    expect(areas.money.progress).toBeCloseTo(3325 / 15865);
    // Out of those coming: the six who said no need no seat.
    expect(areas.seating).toMatchObject({ summary: "97 of 100 seated", detail: "14 tables", progress: 0.97 });
    expect(areas["place-cards"]).toMatchObject({ summary: "100 cards", detail: "Drawn from the room" });
    expect(areas.timeline).toMatchObject({ summary: "27 blocks", detail: "07:00 to 01:00 +1" });
    expect(areas.delegation).toMatchObject({
      summary: "9 jobs",
      detail: "All have somebody · 1 of 3 suppliers confirmed",
      progress: 1,
    });
    expect(areas["group-shots"].summary).toBe("26 shots");
    // Nineteen tasks before the day, seven of them done.
    expect(areas.checklist).toMatchObject({ summary: "12 to do", detail: "7 done" });
  });

  it("leaves out the areas of tools the wedding does not show, and always keeps the guests", () => {
    const removed = { ...raw, tools: { shown: ["timeline", "money"] } };
    expect(overview(migrate(removed), removed).map((area) => area.id)).toEqual(["guests", "money", "timeline"]);
  });

  it("says there is nothing yet, rather than that nothing is wrong, on an empty wedding", () => {
    const empty = migrate({});
    for (const area of overview(empty, {})) {
      expect(area.summary, area.id).toMatch(/^No /);
      expect(area.progress, area.id).toBeNull();
    }
  });
});
