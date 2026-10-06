import { guestName, isComing } from "@/lib/model/slices";
import type { Event as WeddingEvent } from "@jfrusher/knotwork";
import { roleLabel } from "@/lib/model/partners";
import type { Cast, CustomRole, Guest, RsvpStatus, Seating, ShotMember } from "@/lib/model/types";

interface ResolvedPerson {
  guestId: string | null;
  name: string;
  rsvpStatus: RsvpStatus | null;
}

export type MemberProblem =
  | { kind: "dangling"; detail: string }
  | { kind: "declined"; name: string }
  | { kind: "empty" };

interface ResolvedGroup {
  label: string;
  people: ResolvedPerson[];
  problems: MemberProblem[];
}

/** Whose names a role is spoken in: the partners'. */
type Names = Pick<WeddingEvent, "partners">;

/** A member's own short description — a role's name, a family's name, a guest's name. */
export function memberDescriptor(
  member: ShotMember,
  guests: Record<string, Guest>,
  seating: Seating,
  customRoles: CustomRole[],
  names: Names,
): string {
  switch (member.kind) {
    case "guest": {
      const guest = guests[member.ref];
      return guest ? guestName(guest) || "Unnamed guest" : "Deleted guest";
    }
    case "family":
      return seating.families[member.ref]?.name ?? "Deleted family";
    case "group":
      return (seating.groups[member.ref] ?? seating.subgroups[member.ref])?.name ?? "Deleted group";
    case "role":
      return roleLabel(member.ref, names);
    case "customRole":
      return customRoles.find((r) => r.id === member.ref)?.name ?? "Deleted role";
    case "text":
      return member.ref;
  }
}

/**
 * A group's members — a group shot's, a processional's — resolved to the
 * people they name right now.
 *
 * Order is preserved as authored, and a guest named twice — once directly,
 * once through a family they belong to — is printed once, at its first
 * position. `guestId` is null for a free-text member, which cannot dedupe
 * against anything and never carries a declined warning.
 */
export function resolveMembers(
  group: { label: string; members: ShotMember[] },
  guests: Record<string, Guest>,
  seating: Seating,
  cast: Cast,
  customRoles: CustomRole[],
  names: Names,
): ResolvedGroup {
  const people: ResolvedPerson[] = [];
  const seen = new Set<string>();
  const problems: MemberProblem[] = [];

  const addGuest = (guestId: string, source: string) => {
    const guest = guests[guestId];
    if (!guest) {
      problems.push({ kind: "dangling", detail: `${source} names a guest who no longer exists` });
      return;
    }
    if (seen.has(guestId)) return;
    seen.add(guestId);
    const name = guestName(guest) || "Unnamed guest";
    people.push({ guestId, name, rsvpStatus: guest.rsvpStatus });
    if (!isComing(guest)) problems.push({ kind: "declined", name });
  };

  for (const member of group.members) {
    resolveMember(member, guests, seating, cast, customRoles, names, addGuest, problems, people);
  }

  if (people.length === 0 && problems.length === 0) problems.push({ kind: "empty" });

  const label =
    group.label.trim() ||
    (group.members.length > 0
      ? group.members.map((m) => memberDescriptor(m, guests, seating, customRoles, names)).join(" + ")
      : "Untitled");

  return { label, people, problems };
}

function resolveMember(
  member: ShotMember,
  guests: Record<string, Guest>,
  seating: Seating,
  cast: Cast,
  customRoles: CustomRole[],
  names: Names,
  addGuest: (guestId: string, source: string) => void,
  problems: MemberProblem[],
  people: ResolvedPerson[],
): void {
  switch (member.kind) {
    case "guest":
      addGuest(member.ref, "A member");
      return;
    case "family": {
      const family = seating.families[member.ref];
      if (!family) {
        problems.push({ kind: "dangling", detail: "A member names a family that no longer exists" });
        return;
      }
      for (const guestId of family.memberIds) addGuest(guestId, `"${family.name}"`);
      return;
    }
    case "group": {
      const group = seating.groups[member.ref] ?? seating.subgroups[member.ref];
      if (!group) {
        problems.push({ kind: "dangling", detail: "A member names a group that no longer exists" });
        return;
      }
      for (const guest of Object.values(guests)) {
        if (guest.groupId === member.ref || guest.subgroupId === member.ref) addGuest(guest.id, `"${group.name}"`);
      }
      return;
    }
    case "role": {
      const guestIds = cast[member.ref];
      if (guestIds.length === 0) {
        problems.push({ kind: "dangling", detail: `No one is set as ${roleLabel(member.ref, names)} yet` });
        return;
      }
      for (const guestId of guestIds) addGuest(guestId, roleLabel(member.ref, names));
      return;
    }
    case "customRole": {
      const role = customRoles.find((r) => r.id === member.ref);
      if (!role) {
        problems.push({ kind: "dangling", detail: "A member names a role that no longer exists" });
        return;
      }
      if (role.guestIds.length === 0) {
        problems.push({ kind: "dangling", detail: `No one is set for "${role.name}" yet` });
        return;
      }
      for (const guestId of role.guestIds) addGuest(guestId, `"${role.name}"`);
      return;
    }
    case "text":
      people.push({ guestId: null, name: member.ref, rsvpStatus: null });
      return;
  }
}
