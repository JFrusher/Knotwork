import { newId } from "@/lib/model/ids";
import type { Ceremony, ShotMember, WalkGroup } from "@/lib/model/types";

/**
 * The processional, edited: groups in the order they walk, and who is in each.
 * Order is the list's order, so moving a group is a splice.
 */

export function newGroup(patch: Partial<WalkGroup> = {}): WalkGroup {
  return { id: newId("walk"), label: "", members: [], formation: "single", side: "", music: "", cue: "", ...patch };
}

export function addGroup(ceremony: Ceremony, group: WalkGroup = newGroup()): Ceremony {
  return { ...ceremony, processional: [...ceremony.processional, group] };
}

export function patchGroup(ceremony: Ceremony, groupId: string, patch: Partial<Omit<WalkGroup, "id">>): Ceremony {
  return {
    ...ceremony,
    processional: ceremony.processional.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
  };
}

export function removeGroup(ceremony: Ceremony, groupId: string): Ceremony {
  return { ...ceremony, processional: ceremony.processional.filter((group) => group.id !== groupId) };
}

/** Moves a group to another place in the order. The same processional back when nothing moves. */
export function moveGroup(ceremony: Ceremony, fromIndex: number, toIndex: number): Ceremony {
  const processional = [...ceremony.processional];
  if (toIndex < 0 || toIndex >= processional.length || fromIndex === toIndex) return ceremony;
  const [moved] = processional.splice(fromIndex, 1);
  if (!moved) return ceremony;
  processional.splice(toIndex, 0, moved);
  return { ...ceremony, processional };
}

export function addMembers(ceremony: Ceremony, groupId: string, members: ShotMember[]): Ceremony {
  return {
    ...ceremony,
    processional: ceremony.processional.map((group) =>
      group.id === groupId ? { ...group, members: [...group.members, ...members] } : group,
    ),
  };
}

export function removeMember(ceremony: Ceremony, groupId: string, index: number): Ceremony {
  return {
    ...ceremony,
    processional: ceremony.processional.map((group) =>
      group.id === groupId ? { ...group, members: group.members.filter((_, i) => i !== index) } : group,
    ),
  };
}
