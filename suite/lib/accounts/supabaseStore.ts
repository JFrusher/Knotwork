import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcceptResult, AccountsStore, MemberRecord, Role } from "./store";

/**
 * The Postgres implementation, over a caller-scoped client.
 *
 * Unlike `lib/sync/supabaseStore.ts`, which uses one service-role client for
 * every caller (authorization there is a token hash checked by hand), this
 * takes a *different* client per call — one carrying the signed-in user's own
 * session — so Postgres RLS and the `security definer` functions in the
 * accounts migrations see the real caller via `auth.uid()`.
 *
 * The acting user's id arguments go unused wherever a function reads
 * `auth.uid()` itself: a caller can never act "as" someone else by passing a
 * different id. They exist for the in-memory fake, which has no session.
 */
const member = (row: Record<string, unknown>): MemberRecord => ({
  userId: row["user_id"] as string,
  weddingId: row["wedding_id"] as string,
  role: row["role"] as Role,
  joinedAt: row["joined_at"] as string,
});

export function accountsStore(client: SupabaseClient): AccountsStore {
  return {
    async createWedding(_userId, role) {
      const { data, error } = await client.rpc("create_wedding", { p_role: role });
      if (error) throw new Error(error.message);
      return { id: data as string, createdAt: new Date().toISOString() };
    },

    async membershipsOf(userId) {
      const { data, error } = await client
        .from("wedding_members")
        .select("user_id, wedding_id, role, joined_at")
        .eq("user_id", userId)
        .order("joined_at");
      if (error) throw new Error(error.message);
      return (data ?? []).map(member);
    },

    async membersOf(weddingId) {
      const { data, error } = await client
        .from("wedding_members")
        .select("user_id, wedding_id, role, joined_at")
        .eq("wedding_id", weddingId);
      if (error) throw new Error(error.message);
      return (data ?? []).map(member);
    },

    async peopleOf(weddingId, _byUserId) {
      const { data, error } = await client.rpc("wedding_people", { p_wedding_id: weddingId });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        userId: row["user_id"] as string,
        email: row["email"] as string,
        role: row["role"] as Role,
        joinedAt: row["joined_at"] as string,
      }));
    },

    async createInvite(weddingId, byUserId, invitedEmail, role) {
      const { data, error } = await client
        .rpc("create_invite", { p_wedding_id: weddingId, p_invited_email: invitedEmail, p_role: role })
        .single();
      if (error) throw new Error(error.message);
      const row = data as { id: string; token: string; expires_at: string };
      return {
        id: row.id,
        weddingId,
        invitedEmail: invitedEmail.toLowerCase(),
        role,
        token: row.token,
        createdBy: byUserId,
        createdAt: new Date().toISOString(),
        expiresAt: row.expires_at,
        acceptedAt: null,
      };
    },

    async acceptInvite(token, _userId) {
      const { data, error } = await client.rpc("accept_invite", { p_token: token }).single();
      if (error) throw new Error(error.message);
      const row = data as {
        accepted: boolean;
        reason: string | null;
        wedding_id: string | null;
        invited_email: string | null;
      };
      return {
        accepted: row.accepted,
        reason: row.reason as AcceptResult["reason"],
        weddingId: row.wedding_id,
        invitedEmail: row.invited_email,
      };
    },

    async removeMember(weddingId, _byUserId, userId) {
      const { error } = await client.rpc("remove_member", { p_wedding_id: weddingId, p_user_id: userId });
      if (error) throw new Error(error.message);
    },

    async deleteAccount(_userId) {
      const { error } = await client.rpc("delete_my_account");
      if (error) throw new Error(error.message);
    },
  };
}
