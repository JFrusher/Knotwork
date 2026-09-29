import { newId } from "@/lib/model/ids";
import type { Cast, CastRole, CastSlice, CustomRole } from "@/lib/model/types";

/**
 * Who is who, edited: the fixed roles, and roles of the couple's own devising.
 * The cast is shared by Group shots and Ceremony, so these belong to neither.
 */

export function setCastRole(cast: CastSlice, role: CastRole, guestIds: string[]): CastSlice {
  return { ...cast, roles: { ...cast.roles, [role]: guestIds } as Cast };
}

export function addCustomRole(cast: CastSlice, name: string): CastSlice {
  const role: CustomRole = { id: newId("crole"), name, guestIds: [] };
  return { ...cast, customRoles: [...cast.customRoles, role] };
}

export function renameCustomRole(cast: CastSlice, roleId: string, name: string): CastSlice {
  return { ...cast, customRoles: cast.customRoles.map((r) => (r.id === roleId ? { ...r, name } : r)) };
}

/**
 * A shot or a processional that still names the role is left as it is, and
 * says so ("Deleted role") — the cast writes only itself.
 */
export function removeCustomRole(cast: CastSlice, roleId: string): CastSlice {
  return { ...cast, customRoles: cast.customRoles.filter((r) => r.id !== roleId) };
}

export function setCustomRoleMembers(cast: CastSlice, roleId: string, guestIds: string[]): CastSlice {
  return { ...cast, customRoles: cast.customRoles.map((r) => (r.id === roleId ? { ...r, guestIds } : r)) };
}
