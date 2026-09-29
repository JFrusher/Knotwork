import { describe, expect, it } from "vitest";
import { emptyCeremony } from "@/lib/model/slices";
import { addGroup, addMembers, moveGroup, newGroup, patchGroup, removeGroup, removeMember } from "./actions";

const three = [newGroup({ id: "g1" }), newGroup({ id: "g2" }), newGroup({ id: "g3" })].reduce(addGroup, emptyCeremony());
const order = (ceremony: typeof three) => ceremony.processional.map((group) => group.id);

describe("the processional", () => {
  it("adds a group at the end, walking alone, with nothing said about it yet", () => {
    const added = addGroup(emptyCeremony());
    expect(added.processional).toHaveLength(1);
    expect(added.processional[0]).toMatchObject({ label: "", members: [], formation: "single", side: "", music: "", cue: "" });
  });

  it("moves a group, and leaves the order alone for a move off either end", () => {
    expect(order(moveGroup(three, 2, 0))).toEqual(["g3", "g1", "g2"]);
    expect(moveGroup(three, 0, -1)).toBe(three);
    expect(moveGroup(three, 2, 3)).toBe(three);
  });

  it("changes and removes a group by id", () => {
    expect(patchGroup(three, "g2", { music: "Canon in D", formation: "pairs" }).processional[1]).toMatchObject({
      id: "g2",
      music: "Canon in D",
      formation: "pairs",
    });
    expect(order(removeGroup(three, "g2"))).toEqual(["g1", "g3"]);
  });

  it("adds several members as one change, and removes one by its place", () => {
    const withCouple = addMembers(three, "g1", [
      { kind: "role", ref: "a" },
      { kind: "role", ref: "b" },
    ]);
    expect(withCouple.processional[0]!.members).toHaveLength(2);
    expect(removeMember(withCouple, "g1", 0).processional[0]!.members).toEqual([{ kind: "role", ref: "b" }]);
  });
});
