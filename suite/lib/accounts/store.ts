/**
 * Where account/wedding membership lives, behind an interface: one real
 * implementation (Postgres, via the SQL functions in the accounts and roles
 * migrations) and one in-memory fake, so the rules in `handlers.ts` can be
 * tested without a database.
 *
 * The rules both hold to (20260928000001_roles.sql): a wedding has up to two
 * partners and one planner; an account is a partner in one wedding at most
 * and a planner in any number.
 */

export type Role = "partner" | "planner";

export interface WeddingRecord {
  id: string;
  createdAt: string;
}

export interface MemberRecord {
  userId: string;
  weddingId: string;
  role: Role;
  joinedAt: string;
}

/** A member with their address — what "who has access" shows. */
export interface PersonRecord {
  userId: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface InviteRecord {
  id: string;
  weddingId: string;
  invitedEmail: string;
  role: Role;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export type AcceptReason =
  | "not-found"
  | "wrong-email"
  | "expired"
  | "already-accepted"
  | "wedding-full"
  | "already-in-a-wedding"
  | "already-a-member";

export interface AcceptResult {
  accepted: boolean;
  reason: AcceptReason | null;
  weddingId: string | null;
  /**
   * The address the invite was sent to, so "this was sent to X" can be shown
   * on a wrong-email rejection. It comes back from the accept itself because
   * the invitee cannot read the `invites` row directly — RLS only lets the
   * person who *created* an invite select it.
   */
  invitedEmail: string | null;
}

export const ROLE_CAP: Record<Role, number> = { partner: 2, planner: 1 };

export interface AccountsStore {
  /** Throws if a partner wedding is asked for by someone who already has one. */
  createWedding(userId: string, role: Role): Promise<WeddingRecord>;
  /** Every wedding the account is on, in whichever role. */
  membershipsOf(userId: string): Promise<MemberRecord[]>;
  membersOf(weddingId: string): Promise<MemberRecord[]>;
  /** Throws unless `byUserId` is on the wedding. */
  peopleOf(weddingId: string, byUserId: string): Promise<PersonRecord[]>;
  /** Throws if the caller is not a member, or the role's places are taken. */
  createInvite(weddingId: string, byUserId: string, invitedEmail: string, role: Role): Promise<InviteRecord>;
  /**
   * `userId` is redundant with the real store's session-derived `auth.uid()`,
   * kept as an explicit parameter here because the in-memory fake has no
   * session to read it from — every caller (handlers.ts, supabaseStore.ts)
   * always has the acting user's id in hand already, so passing it costs
   * nothing.
   */
  acceptInvite(token: string, userId: string): Promise<AcceptResult>;
  /** Yourself from any wedding, or its planner by one of the couple. Throws otherwise. */
  removeMember(weddingId: string, byUserId: string, userId: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
}

export function memoryStore(): AccountsStore {
  const weddings = new Map<string, WeddingRecord>();
  let members: MemberRecord[] = [];
  const invites = new Map<string, InviteRecord>(); // keyed by token
  const emails = new Map<string, string>(); // userId -> email, seeded by tests

  const now = () => new Date().toISOString();
  const count = (weddingId: string, role: Role) =>
    members.filter((m) => m.weddingId === weddingId && m.role === role).length;
  const isPartnerSomewhere = (userId: string) => members.some((m) => m.userId === userId && m.role === "partner");
  const onWedding = (weddingId: string, userId: string) =>
    members.find((m) => m.weddingId === weddingId && m.userId === userId);
  const leave = (weddingId: string, userId: string) => {
    members = members.filter((m) => !(m.weddingId === weddingId && m.userId === userId));
    if (!members.some((m) => m.weddingId === weddingId)) weddings.delete(weddingId);
  };

  return {
    async createWedding(userId, role) {
      if (role === "partner" && isPartnerSomewhere(userId)) throw new Error("already has a wedding");
      const wedding: WeddingRecord = { id: crypto.randomUUID(), createdAt: now() };
      weddings.set(wedding.id, wedding);
      members.push({ userId, weddingId: wedding.id, role, joinedAt: now() });
      return wedding;
    },

    async membershipsOf(userId) {
      return members.filter((m) => m.userId === userId);
    },

    async membersOf(weddingId) {
      return members.filter((m) => m.weddingId === weddingId);
    },

    async peopleOf(weddingId, byUserId) {
      if (!onWedding(weddingId, byUserId)) throw new Error("not a member of that wedding");
      return members
        .filter((m) => m.weddingId === weddingId)
        .map((m) => ({ userId: m.userId, email: emails.get(m.userId) ?? "", role: m.role, joinedAt: m.joinedAt }));
    },

    async createInvite(weddingId, byUserId, invitedEmail, role) {
      if (!onWedding(weddingId, byUserId)) throw new Error("not a member of that wedding");
      if (count(weddingId, role) >= ROLE_CAP[role]) throw new Error(`no ${role} place left`);
      const invite: InviteRecord = {
        id: crypto.randomUUID(),
        weddingId,
        invitedEmail: invitedEmail.toLowerCase(),
        role,
        token: crypto.randomUUID().replace(/-/g, ""),
        createdBy: byUserId,
        createdAt: now(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        acceptedAt: null,
      };
      invites.set(invite.token, invite);
      return invite;
    },

    async acceptInvite(token, userId) {
      const invite = invites.get(token);
      if (!invite) return { accepted: false, reason: "not-found", weddingId: null, invitedEmail: null };
      const no = (reason: AcceptReason): AcceptResult => ({
        accepted: false,
        reason,
        weddingId: invite.weddingId,
        invitedEmail: invite.invitedEmail,
      });

      if (invite.acceptedAt) return no("already-accepted");
      if (new Date(invite.expiresAt).getTime() < Date.now()) return no("expired");
      const callerEmail = (emails.get(userId) ?? "").toLowerCase();
      if (callerEmail !== invite.invitedEmail) return no("wrong-email");
      if (onWedding(invite.weddingId, userId)) return no("already-a-member");
      if (count(invite.weddingId, invite.role) >= ROLE_CAP[invite.role]) return no("wedding-full");
      if (invite.role === "partner" && isPartnerSomewhere(userId)) return no("already-in-a-wedding");

      members.push({ userId, weddingId: invite.weddingId, role: invite.role, joinedAt: now() });
      invite.acceptedAt = now();
      return { accepted: true, reason: null, weddingId: invite.weddingId, invitedEmail: invite.invitedEmail };
    },

    async removeMember(weddingId, byUserId, userId) {
      const target = onWedding(weddingId, userId);
      if (!target) throw new Error("not a member of that wedding");
      const byPartner = onWedding(weddingId, byUserId)?.role === "partner";
      if (userId !== byUserId && !(target.role === "planner" && byPartner)) {
        throw new Error("only the couple can remove their planner");
      }
      leave(weddingId, userId);
    },

    async deleteAccount(userId) {
      for (const m of members.filter((m) => m.userId === userId)) leave(m.weddingId, userId);
    },

    // test-only seams, not part of the interface real Postgres implements —
    // the handler tests call these directly on the object memoryStore()
    // returns. (`_expire` stands in for waiting fourteen days; Postgres has
    // its own `expires_at` column to update instead.)
    _seedEmail(userId: string, email: string) {
      emails.set(userId, email);
    },
    _expire(token: string) {
      const invite = invites.get(token);
      if (invite) invite.expiresAt = new Date(0).toISOString();
    },
  } as AccountsStore & { _seedEmail(userId: string, email: string): void; _expire(token: string): void };
}
