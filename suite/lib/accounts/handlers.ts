import type { DocumentStore } from "@/lib/documents/store";
import { ROLE_CAP, type AccountsStore, type Role } from "./store";

export interface Reply {
  status: number;
  body: unknown;
}

const ok = (body: unknown): Reply => ({ status: 200, body });
const conflict = (message: string, extra: Record<string, unknown> = {}): Reply => ({
  status: 409,
  body: { error: message, ...extra },
});
const forbidden = (message: string): Reply => ({ status: 403, body: { error: message } });
const notFound = (message: string): Reply => ({ status: 404, body: { error: message } });

export async function createWeddingHandler(store: AccountsStore, userId: string, role: Role): Promise<Reply> {
  const memberships = await store.membershipsOf(userId);
  if (role === "partner" && memberships.some((m) => m.role === "partner")) {
    return conflict("You already have a wedding of your own.");
  }
  const wedding = await store.createWedding(userId, role);
  return ok({ weddingId: wedding.id });
}

/**
 * A first sign-in starts the couple's wedding. Anyone already on one — a
 * returning partner, a planner with clients — is left exactly as they are.
 */
export async function firstSignInHandler(store: AccountsStore, userId: string): Promise<Reply> {
  if ((await store.membershipsOf(userId)).length > 0) return ok({ weddingId: null });
  return createWeddingHandler(store, userId, "partner");
}

/** One wedding in the account's list: enough to recognise it and switch to it. */
export interface WeddingListing {
  weddingId: string;
  role: Role;
  names: string;
  date: string;
}

/** Every wedding the account is on, named from its own document. */
export async function listWeddingsHandler(
  accounts: AccountsStore,
  documents: DocumentStore,
  userId: string,
): Promise<Reply> {
  const memberships = await accounts.membershipsOf(userId);
  const weddings: WeddingListing[] = await Promise.all(
    memberships.map(async (m) => {
      const record = await documents.getDocument(m.weddingId);
      const event = (record?.document as { event?: { coupleNames?: string; date?: string } } | undefined)?.event;
      return { weddingId: m.weddingId, role: m.role, names: event?.coupleNames ?? "", date: event?.date ?? "" };
    }),
  );
  return ok({ weddings });
}

export async function createInviteHandler(
  store: AccountsStore,
  weddingId: string,
  byUserId: string,
  invitedEmail: string,
  role: Role,
): Promise<Reply> {
  const members = await store.membersOf(weddingId);
  if (!members.some((m) => m.userId === byUserId)) {
    return forbidden("You are not a member of that wedding.");
  }
  if (members.filter((m) => m.role === role).length >= ROLE_CAP[role]) {
    return conflict(role === "partner" ? "This wedding already has both of its couple." : "This wedding already has a planner.");
  }
  const invite = await store.createInvite(weddingId, byUserId, invitedEmail, role);
  return ok({ token: invite.token, expiresAt: invite.expiresAt });
}

export async function acceptInviteHandler(
  store: AccountsStore,
  token: string,
  userId: string,
): Promise<Reply> {
  // No lookup before the accept: the invitee can't read their own invite row
  // (RLS shows `invites` only to whoever created them), so `acceptInvite`
  // answers "no such token" itself, as one more rejection reason.
  const result = await store.acceptInvite(token, userId);
  if (result.accepted) return ok({ weddingId: result.weddingId });
  if (result.reason === "not-found") return notFound("That invite does not exist.");

  const messages: Record<string, string> = {
    "wrong-email": `This invite was sent to ${result.invitedEmail}. Sign in with that address to accept it.`,
    expired: "That invite has expired. Ask for a new one.",
    "already-accepted": "That invite was already used.",
    "wedding-full": "That place on the wedding has been taken already.",
    "already-in-a-wedding":
      "You are already one of the couple on a wedding of your own — leave it first if you want to join this one.",
    "already-a-member": "You are already on this wedding.",
  };
  return conflict(messages[result.reason ?? ""] ?? "That invite could not be accepted.", {
    reason: result.reason,
  });
}

/** Who has access to a wedding. Only its own members may ask. */
export async function peopleHandler(store: AccountsStore, weddingId: string, byUserId: string): Promise<Reply> {
  const members = await store.membersOf(weddingId);
  if (!members.some((m) => m.userId === byUserId)) return forbidden("You are not a member of that wedding.");
  return ok({ people: await store.peopleOf(weddingId, byUserId) });
}

/**
 * Leaving a wedding, or the couple removing their planner. A planner never
 * removes one of the couple: whose plans these are is theirs to decide.
 */
export async function removeMemberHandler(
  store: AccountsStore,
  weddingId: string,
  byUserId: string,
  userId: string,
): Promise<Reply> {
  const members = await store.membersOf(weddingId);
  const by = members.find((m) => m.userId === byUserId);
  const target = members.find((m) => m.userId === userId);
  if (!by || !target) return notFound("That person is not on this wedding.");
  if (userId !== byUserId && !(target.role === "planner" && by.role === "partner")) {
    return forbidden("Only the couple can remove their planner.");
  }
  await store.removeMember(weddingId, byUserId, userId);
  return ok({});
}

export async function deleteAccountHandler(store: AccountsStore, userId: string): Promise<Reply> {
  await store.deleteAccount(userId);
  return ok({});
}
