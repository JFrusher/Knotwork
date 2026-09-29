import { describe, expect, it } from "vitest";
import { emptyCastSlice } from "@/lib/model/slices";
import { addCustomRole, removeCustomRole, renameCustomRole, setCastRole, setCustomRoleMembers } from "./actions";

const empty = emptyCastSlice();

describe("roles", () => {
  it("sets a role's guest ids, replacing whatever was there", () => {
    const withRole = setCastRole(empty, "a", ["g1"]);
    expect(withRole.roles.a).toEqual(["g1"]);
    expect(setCastRole(withRole, "a", []).roles.a).toEqual([]);
  });

  it("holds each partner's grandparents, as many as there are", () => {
    expect(setCastRole(empty, "b-grandparents", ["g1", "g2"]).roles["b-grandparents"]).toEqual(["g1", "g2"]);
  });
});

describe("custom roles", () => {
  it("adds a custom role by name", () => {
    const cast = addCustomRole(empty, "Me and my family");
    expect(cast.customRoles).toHaveLength(1);
    expect(cast.customRoles[0]).toMatchObject({ name: "Me and my family", guestIds: [] });
  });

  it("renames a custom role by id", () => {
    const cast = addCustomRole(empty, "Old name");
    const id = cast.customRoles[0]!.id;
    expect(renameCustomRole(cast, id, "New name").customRoles[0]!.name).toBe("New name");
  });

  it("removes a custom role by id", () => {
    const cast = addCustomRole(empty, "Gone");
    const id = cast.customRoles[0]!.id;
    expect(removeCustomRole(cast, id).customRoles).toEqual([]);
  });

  it("sets a custom role's guest ids, replacing whatever was there", () => {
    const cast = addCustomRole(empty, "Ushers");
    const id = cast.customRoles[0]!.id;
    const withMembers = setCustomRoleMembers(cast, id, ["g1", "g2"]);
    expect(withMembers.customRoles[0]!.guestIds).toEqual(["g1", "g2"]);
    expect(setCustomRoleMembers(withMembers, id, []).customRoles[0]!.guestIds).toEqual([]);
  });
});
