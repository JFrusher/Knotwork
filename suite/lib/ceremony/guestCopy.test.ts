import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { dayPlaces } from "@/lib/model/slices";
import { weddingGuestBlocks } from "./guestCopy";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const withCopy = (guestCopy: Record<string, unknown>) => migrate({ ...raw, ceremony: { ...raw.ceremony, guestCopy } });
const places = [...dayPlaces(migrate(raw)).entries()].sort(([, a], [, b]) => a.startMin - b.startMin);

describe("the guests' copy of the wedding", () => {
  it("is the ceremony alone until the couple writes or chooses more", () => {
    const blocks = weddingGuestBlocks(migrate(raw));
    expect(blocks[0]!.title).toBe("Music as guests arrive");
    expect(blocks.at(-1)!.title).toBe("The recessional");
  });

  it("opens with their welcome and closes with their thanks, around the ceremony, who is who and what happens after", () => {
    const later = places.filter(([, place]) => place.startMin >= 14 * 60).slice(0, 2);
    const blocks = weddingGuestBlocks(
      withCopy({ welcome: "Welcome, and thank you for coming.", thanks: "With love, Alex & Sam", weddingParty: true, dayBlockIds: later.map(([id]) => id).reverse() }),
    );
    expect(blocks[0]).toMatchObject({ title: "", passages: [{ text: "Welcome, and thank you for coming.", layout: "poem" }] });
    expect(blocks[1]!.title).toBe("Music as guests arrive");

    const party = blocks.find((block) => block.title === "The wedding party")!;
    expect(party.lines).toContain("Sam’s mother: Lucia Reyes");
    expect(party.lines.some((line) => line.startsWith("Alex’s wedding party: "))).toBe(true);

    const after = blocks.find((block) => block.title === "After the ceremony")!;
    // In the order of the day, whatever order they were ticked in.
    expect(after.lines).toHaveLength(2);
    expect(after.lines[0]).toContain(later[0]![1].label);
    expect(blocks.at(-1)).toMatchObject({ title: "", passages: [{ text: "With love, Alex & Sam" }] });
  });

  it("leaves out a part of the day that is no longer on the Timeline", () => {
    const blocks = weddingGuestBlocks(withCopy({ dayBlockIds: ["gone"] }));
    expect(blocks.some((block) => block.title === "After the ceremony")).toBe(false);
  });
});
