import type { SupabaseClient } from "@supabase/supabase-js";
import { accountsStore } from "./supabaseStore";

/**
 * Whether the caller is on a wedding. RLS says the same thing again at the
 * database: a member-only read here, member-only policies there.
 */
export async function isOnWedding(client: SupabaseClient, userId: string, weddingId: string): Promise<boolean> {
  const members = await accountsStore(client).membersOf(weddingId);
  return members.some((m) => m.userId === userId);
}

/**
 * The wedding a request names in `?wedding=`, if the caller is on it.
 *
 * An account can be on several — a planner has one per client — so the
 * client always says which, and it is never inferred.
 */
export async function requestedWedding(request: Request, client: SupabaseClient, userId: string): Promise<string | null> {
  const weddingId = new URL(request.url).searchParams.get("wedding");
  if (!weddingId) return null;
  return (await isOnWedding(client, userId, weddingId)) ? weddingId : null;
}
