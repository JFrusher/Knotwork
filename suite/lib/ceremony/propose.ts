import type { CastRole, CastSlice, Formation, Side, WalkGroup } from "@/lib/model/types";
import { newGroup } from "./actions";

/**
 * A starting order for the processional, from who is who: the officiant in
 * place, the grandparents, the parents, the wedding parties, and then the
 * couple, together.
 *
 * A starting point, every part of it the couple's to change. It leaves out a
 * role nobody has been cast in, and assumes nothing about who walks with whom:
 * whether one of the couple walks with a parent, or waits at the front, is
 * theirs to say. The couple are always in it, cast or not, so that a wedding
 * with nobody in Who's who is told so rather than handed an empty aisle.
 */
export function suggestOrder(cast: CastSlice): WalkGroup[] {
  const walking = (roles: CastRole[], formation: Formation, side: Side): WalkGroup[] => {
    const present = roles.filter((role) => cast.roles[role].length > 0);
    return present.length === 0 ? [] : [newGroup({ members: present.map((ref) => ({ kind: "role", ref })), formation, side })];
  };

  return [
    newGroup({ members: [{ kind: "text", ref: "The officiant" }], cue: "In place before the music starts" }),
    ...walking(["a-grandparents"], "pairs", "a"),
    ...walking(["b-grandparents"], "pairs", "b"),
    ...walking(["a-mother", "a-father"], "pairs", "a"),
    ...walking(["b-mother", "b-father"], "pairs", "b"),
    ...walking(["a-party"], "pairs", "a"),
    ...walking(["b-party"], "pairs", "b"),
    newGroup({ members: [{ kind: "role", ref: "a" }, { kind: "role", ref: "b" }], formation: "pairs" }),
  ];
}
