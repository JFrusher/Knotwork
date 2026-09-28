// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getHandler, listHandler, removeHandler, saveHandler } from "./handlers";
import { memoryStore } from "./store";

describe("a planner's library", () => {
  it("keeps what is saved, lists it newest first, and gives it back", async () => {
    const store = memoryStore();
    await saveHandler(store, "p1", { kind: "day", name: "Summer day", content: { blocks: [] } });
    const saved = (await saveHandler(store, "p1", { kind: "room", name: "The Old Granary", content: { tables: {} } })).body as { item: { id: string } };

    const listed = (await listHandler(store, "p1")).body as { items: Array<{ name: string }> };
    expect(listed.items.map((item) => item.name)).toEqual(["The Old Granary", "Summer day"]);
    expect((await getHandler(store, "p1", saved.item.id)).body).toEqual({ content: { tables: {} } });
  });

  it("keeps each planner to their own", async () => {
    const store = memoryStore();
    const saved = (await saveHandler(store, "p1", { kind: "day", name: "Summer day", content: {} })).body as { item: { id: string } };
    expect((await listHandler(store, "p2")).body).toEqual({ items: [] });
    expect((await getHandler(store, "p2", saved.item.id)).status).toBe(404);
    expect((await removeHandler(store, "p2", saved.item.id)).status).toBe(404);
    expect((await removeHandler(store, "p1", saved.item.id)).status).toBe(200);
  });

  it("refuses a kind it does not keep, or no name", async () => {
    const store = memoryStore();
    expect((await saveHandler(store, "p1", { kind: "guests", name: "Everyone", content: {} })).status).toBe(400);
    expect((await saveHandler(store, "p1", { kind: "day", name: "  ", content: {} })).body).toEqual({ error: "name: Give it a name." });
  });
});
