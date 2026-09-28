// @vitest-environment node
import { describe, expect, it } from "vitest";
import { changeGuests, dropGuests, seatGuests, type GuestSlices } from "./edit";

const slices = (): GuestSlices => ({
  guests: {
    g1: { id: "g1", firstName: "Ada", lastName: "Byron", assignedTableId: "t1", tags: [], seatingOnly: "kept" },
    g2: { id: "g2", firstName: "Alan", lastName: "Turing", assignedTableId: null, tags: ["uni"] },
    g3: { id: "g3", firstName: "Grace", lastName: "Hopper", assignedTableId: "t2", assignedSeatId: "t2:1" },
  },
  seating: {
    tables: {
      t1: { id: "t1", label: "Table 1", capacity: 8, seatMode: "table", assignedGuestIds: ["g1"] },
      t2: { id: "t2", label: "Table 2", capacity: 4, seatMode: "seat", assignedGuestIds: [null, "g3", null, null] },
    },
    groups: { gr: { id: "gr", name: "Friends", memberIds: ["g2"] } },
    room: { width: 20 },
  },
});

describe("changing guests from the list", () => {
  it("sets a reply on several at once, and keeps every field it did not change", () => {
    const next = changeGuests(slices(), ["g1", "g2"], { rsvpStatus: "declined" });
    expect(next.guests["g1"]).toMatchObject({ rsvpStatus: "declined", seatingOnly: "kept", assignedTableId: "t1" });
    expect(next.guests["g2"]).toMatchObject({ rsvpStatus: "declined" });
    expect(next.guests["g3"]).toEqual(slices().guests["g3"]);
    expect(next.seating).toEqual(slices().seating);
  });

  it("reads a requirement from the guest's own words, as Seating does", () => {
    const next = changeGuests(slices(), ["g2"], { dietaryRaw: "Coeliac" });
    expect(next.guests["g2"]).toMatchObject({ dietaryRaw: "Coeliac", dietary: "gluten-free" });
  });

  it("adds a tag once, and takes one away", () => {
    let next = changeGuests(slices(), ["g1", "g2"], { addTag: "uni" });
    expect(next.guests["g1"]).toMatchObject({ tags: ["uni"] });
    expect(next.guests["g2"]).toMatchObject({ tags: ["uni"] });
    next = changeGuests(next, ["g2"], { removeTag: "uni" });
    expect(next.guests["g2"]).toMatchObject({ tags: [] });
  });
});

describe("seating guests from the list", () => {
  it("moves the guest and both tables' lists together", () => {
    const next = seatGuests(slices(), ["g1", "g2"], "t1");
    expect(next.guests["g2"]).toMatchObject({ assignedTableId: "t1" });
    const tables = next.seating["tables"] as Record<string, { assignedGuestIds: unknown[] }>;
    expect(tables["t1"]!.assignedGuestIds).toEqual(["g1", "g2"]);
  });

  it("frees a seat-level table's chair without closing the gap", () => {
    const next = seatGuests(slices(), ["g3"], "t1");
    const tables = next.seating["tables"] as Record<string, { assignedGuestIds: unknown[] }>;
    expect(tables["t2"]!.assignedGuestIds).toEqual([null, null, null, null]);
    expect(tables["t1"]!.assignedGuestIds).toEqual(["g1", "g3"]);
    expect(next.guests["g3"]).toMatchObject({ assignedTableId: "t1", assignedSeatId: null });
  });

  it("takes a guest off their table", () => {
    const next = seatGuests(slices(), ["g1"], null);
    expect(next.guests["g1"]).toMatchObject({ assignedTableId: null });
    const tables = next.seating["tables"] as Record<string, { assignedGuestIds: unknown[] }>;
    expect(tables["t1"]!.assignedGuestIds).toEqual([]);
    // The rest of the room is untouched.
    expect(next.seating["room"]).toEqual({ width: 20 });
  });
});

describe("removing guests from the list", () => {
  it("takes them out of their table and their group as well", () => {
    const next = dropGuests(slices(), ["g1", "g2"]);
    expect(Object.keys(next.guests)).toEqual(["g3"]);
    const seating = next.seating as { tables: Record<string, { assignedGuestIds: unknown[] }>; groups: Record<string, { memberIds: string[] }> };
    expect(seating.tables["t1"]!.assignedGuestIds).toEqual([]);
    expect(seating.groups["gr"]!.memberIds).toEqual([]);
  });
});
