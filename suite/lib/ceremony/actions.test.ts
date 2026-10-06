import { describe, expect, it } from "vitest";
import { emptyCeremony } from "@/lib/model/slices";
import { addGroup, addMembers, addMoment, blankSong, moveGroup, moveMoment, newGroup, patchGroup, patchMoment, removeGroup, removeMember, removeMoment } from "./actions";
import { newMoment } from "./moments";

const three = [newGroup({ id: "g1" }), newGroup({ id: "g2" }), newGroup({ id: "g3" })].reduce(addGroup, emptyCeremony());
const order = (ceremony: typeof three) => ceremony.processional.map((group) => group.id);

describe("the processional", () => {
  it("adds a group at the end, walking alone, with nothing said about it yet", () => {
    const added = addGroup(emptyCeremony());
    expect(added.processional).toHaveLength(1);
    expect(added.processional[0]).toMatchObject({ label: "", members: [], formation: "single", side: "", song: null, cue: "" });
  });

  it("moves a group, and leaves the order alone for a move off either end", () => {
    expect(order(moveGroup(three, 2, 0))).toEqual(["g3", "g1", "g2"]);
    expect(moveGroup(three, 0, -1)).toBe(three);
    expect(moveGroup(three, 2, 3)).toBe(three);
  });

  it("changes and removes a group by id", () => {
    const canon = blankSong({ title: "Canon in D" });
    expect(patchGroup(three, "g2", { song: canon, formation: "pairs" }).processional[1]).toMatchObject({
      id: "g2",
      song: canon,
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

describe("the order of service", () => {
  const service = [newMoment("welcome"), newMoment("reading"), newMoment("vows")].reduce(addMoment, emptyCeremony());

  it("makes a moment of a kind with its usual title and length", () => {
    expect(newMoment("signing")).toMatchObject({ kind: "signing", title: "Signing the register", minutes: 10, song: null, printWords: false, printLyrics: false, approved: false });
    expect(newMoment("music").minutes).toBeNull();
  });

  it("moves, changes and removes a moment", () => {
    const ids = service.order.map((moment) => moment.id);
    expect(moveMoment(service, 2, 0).order.map((moment) => moment.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(moveMoment(service, 0, -1)).toBe(service);
    expect(patchMoment(service, ids[1]!, { title: "Sonnet 116" }).order[1]!.title).toBe("Sonnet 116");
    expect(removeMoment(service, ids[0]!).order).toHaveLength(2);
  });
});
