import { describe, expect, it } from "vitest";
import { emptyTrousseau, migrate } from "@jfrusher/trousseau";
import { TOOLS } from "@/lib/tools";
import { hiddenToolIds, shownTools, withTool } from "./toolbox";

const ids = (doc: Parameters<typeof shownTools>[0]) => shownTools(doc).map((tool) => tool.id);

describe("shownTools", () => {
  it("shows the five when the wedding has never chosen, and leaves the rest in the toolbox", () => {
    const doc = emptyTrousseau();
    expect(ids(doc)).toEqual(["seating", "place-cards", "timeline", "delegation", "group-shots"]);
    expect([...hiddenToolIds(doc)]).toEqual(["ceremony", "money", "checklist", "binder"]);
    expect(shownTools(doc)).toBe(shownTools(emptyTrousseau()));
  });

  it("shows what is stored, in the registry's order rather than the stored one", () => {
    const doc = migrate({ tools: { shown: ["group-shots", "seating"] } });
    expect(ids(doc)).toEqual(["seating", "group-shots"]);
    expect([...hiddenToolIds(doc)]).toEqual(["place-cards", "timeline", "delegation", "ceremony", "money", "checklist", "binder"]);
  });

  it("shows nothing when everything has been removed", () => {
    expect(ids(migrate({ tools: { shown: [] } }))).toEqual([]);
  });

  it("ignores an id this build does not know", () => {
    expect(ids(migrate({ tools: { shown: ["bar", "timeline"] } }))).toEqual(["timeline"]);
  });

  it("every tool's address is its id", () => {
    for (const tool of TOOLS) expect(tool.href).toBe(`/${tool.id}`);
  });
});

describe("withTool", () => {
  it("removing from a wedding that never chose keeps the other four", () => {
    expect(withTool({}, "seating", false)).toEqual({
      shown: ["place-cards", "timeline", "delegation", "group-shots"],
    });
  });

  it("adding one of the rest to a wedding that never chose keeps the five", () => {
    expect(withTool({}, "money", true)).toEqual({
      shown: ["seating", "place-cards", "timeline", "delegation", "group-shots", "money"],
    });
  });

  it("adding back puts it in the list once", () => {
    const removed = { tools: withTool({}, "seating", false) };
    const added = withTool(removed, "seating", true);
    expect(added["shown"]).toEqual(["place-cards", "timeline", "delegation", "group-shots", "seating"]);
    expect(withTool({ tools: added }, "seating", true)["shown"]).toEqual(added["shown"]);
  });

  it("keeps an id this build does not know, and the slice's other keys", () => {
    const raw = { tools: { shown: ["bar", "seating", "timeline"], note: "from a newer build" } };
    expect(withTool(raw, "seating", false)).toEqual({ shown: ["bar", "timeline"], note: "from a newer build" });
  });
});
