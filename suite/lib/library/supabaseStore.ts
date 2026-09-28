import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kind } from "./items";
import type { LibraryListing, LibraryStore } from "./store";

const listing = (row: Record<string, unknown>): LibraryListing => ({
  id: row["id"] as string,
  kind: row["kind"] as Kind,
  name: row["name"] as string,
  createdAt: row["created_at"] as string,
});

/**
 * The library table, through the signed-in account's own session: row-level
 * security is what keeps each planner to their own. The owner is still named
 * in every query, so a mistake here returns nothing rather than relying on the
 * policy alone.
 */
export function libraryStore(client: SupabaseClient): LibraryStore {
  return {
    async list(owner) {
      const { data, error } = await client
        .from("library_items")
        .select("id, kind, name, created_at")
        .eq("owner", owner)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(listing);
    },
    async get(owner, id) {
      const { data, error } = await client.from("library_items").select("content").eq("owner", owner).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.content ?? null;
    },
    async save(owner, kind, name, content) {
      const { data, error } = await client
        .from("library_items")
        .insert({ owner, kind, name, content })
        .select("id, kind, name, created_at")
        .single();
      if (error) throw new Error(error.message);
      return listing(data);
    },
    async remove(owner, id) {
      const { data, error } = await client.from("library_items").delete().eq("owner", owner).eq("id", id).select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
  };
}
