import { describe, expect, it } from "vitest";
import { check, inviteSchema, tokenSchema } from "./schemas";

const invite = { weddingId: "0b7c2d36-5a3e-4f0e-9d1a-2c6b8e4f1a90", email: "partner@example.com", role: "partner" };

describe("inviteSchema", () => {
  it("accepts a wedding, an address and a role", () => {
    expect(check(inviteSchema, invite).ok).toBe(true);
    expect(check(inviteSchema, { ...invite, role: "planner" }).ok).toBe(true);
  });

  it("rejects something that is not an email", () => {
    expect(check(inviteSchema, { ...invite, email: "not-an-email" }).ok).toBe(false);
  });

  it("rejects a role that is not one", () => {
    expect(check(inviteSchema, { ...invite, role: "bride" }).ok).toBe(false);
  });

  it("rejects an invite that names no wedding", () => {
    const { weddingId: _, ...rest } = invite;
    expect(check(inviteSchema, rest).ok).toBe(false);
  });
});

describe("tokenSchema", () => {
  it("accepts the hex shape create_invite actually produces", () => {
    const result = check(tokenSchema, "a1b2c3d4e5f60718293a4b5c6d7e8f90");
    expect(result.ok).toBe(true);
  });

  it("rejects a token with disallowed characters", () => {
    const result = check(tokenSchema, "../../etc/passwd");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty token", () => {
    const result = check(tokenSchema, "");
    expect(result.ok).toBe(false);
  });
});
