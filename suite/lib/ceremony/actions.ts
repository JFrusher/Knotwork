import { newId } from "@/lib/model/ids";
import type { Ceremony, Moment, ShotMember, Song, WalkGroup } from "@/lib/model/types";

/**
 * The ceremony, edited: its facts and witnesses, the order of service, and the
 * processional's groups in the order they walk. Order is a list's order, so
 * moving something is a splice.
 */

/** A song with nothing chosen yet. */
export function blankSong(patch: Partial<Song> = {}): Song {
  return { title: "", artist: "", playedBy: "", startSec: null, endSec: null, lyrics: "", ...patch };
}

/** Moves an item to another place in a list; the same list back when nothing moves. */
function moved<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return items;
  next.splice(toIndex, 0, item);
  return next;
}

export function setFacts(ceremony: Ceremony, patch: Partial<Pick<Ceremony, "kind" | "blockId" | "officiant" | "notes">>): Ceremony {
  return { ...ceremony, ...patch };
}

export function addWitnesses(ceremony: Ceremony, members: ShotMember[]): Ceremony {
  return { ...ceremony, witnesses: [...ceremony.witnesses, ...members] };
}

export function removeWitness(ceremony: Ceremony, index: number): Ceremony {
  return { ...ceremony, witnesses: ceremony.witnesses.filter((_, i) => i !== index) };
}

export function addMoment(ceremony: Ceremony, moment: Moment): Ceremony {
  return { ...ceremony, order: [...ceremony.order, moment] };
}

export function patchMoment(ceremony: Ceremony, momentId: string, patch: Partial<Omit<Moment, "id">>): Ceremony {
  return { ...ceremony, order: ceremony.order.map((moment) => (moment.id === momentId ? { ...moment, ...patch } : moment)) };
}

export function removeMoment(ceremony: Ceremony, momentId: string): Ceremony {
  return { ...ceremony, order: ceremony.order.filter((moment) => moment.id !== momentId) };
}

export function moveMoment(ceremony: Ceremony, fromIndex: number, toIndex: number): Ceremony {
  const order = moved(ceremony.order, fromIndex, toIndex);
  return order === ceremony.order ? ceremony : { ...ceremony, order };
}

export function addMomentMembers(ceremony: Ceremony, momentId: string, members: ShotMember[]): Ceremony {
  return {
    ...ceremony,
    order: ceremony.order.map((moment) => (moment.id === momentId ? { ...moment, members: [...moment.members, ...members] } : moment)),
  };
}

export function removeMomentMember(ceremony: Ceremony, momentId: string, index: number): Ceremony {
  return {
    ...ceremony,
    order: ceremony.order.map((moment) =>
      moment.id === momentId ? { ...moment, members: moment.members.filter((_, i) => i !== index) } : moment,
    ),
  };
}

export function newGroup(patch: Partial<WalkGroup> = {}): WalkGroup {
  return { id: newId("walk"), label: "", members: [], formation: "single", side: "", song: null, cue: "", ...patch };
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
  const processional = moved(ceremony.processional, fromIndex, toIndex);
  return processional === ceremony.processional ? ceremony : { ...ceremony, processional };
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
