import type { SupabaseClient } from "@supabase/supabase-js";
import { accountsStore } from "./supabaseStore";

/**
 * The wedding a request names in `?wedding=`, if the caller is on it.
 *
 * An account can be on several — a planner has one per client — so the
 * client always says which, and it is never inferred. RLS says the same thing
 * again at the database: a member-only read here and member-only policies
 * there.
 */
export async function requestedWedding(request: Request, client: SupabaseClient, userId: string): Promise<string | null> {
  const weddingId = new URL(request.url).searchParams.get("wedding");
  if (!weddingId) return null;
  const members = await accountsStore(client).membersOf(weddingId);
  return members.some((m) => m.userId === userId) ? weddingId : null;
}
