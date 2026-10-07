import type { SupabaseClient } from "@supabase/supabase-js";
import type { HelperStore } from "./store";

/** Over a caller-scoped client: row-level security and the functions see the real caller. */
export function helperStore(client: SupabaseClient): HelperStore {
  return {
    async linksOf(weddingId) {
      const { data, error } = await client
        .from("helper_links")
        .select("person_id, token, share_key, fingerprint, published_at")
        .eq("wedding_id", weddingId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        personId: row.person_id as string,
        token: row.token as string,
        key: row.share_key as string,
        fingerprint: row.fingerprint as string,
        publishedAt: row.published_at as string,
      }));
    },

    async publish(weddingId, input) {
      const { data, error } = await client
        .rpc("publish_helper_link", {
          p_wedding_id: weddingId,
          p_person_id: input.personId,
          p_share_key: input.key,
          p_ciphertext: input.ciphertext,
          p_iv: input.iv,
          p_fingerprint: input.fingerprint,
        })
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as { token: string; published_at: string };
      return { token: row.token, publishedAt: row.published_at };
    },

    async takeDown(weddingId, personId) {
      const { error } = await client.rpc("take_down_helper_link", { p_wedding_id: weddingId, p_person_id: personId });
      if (error) throw new Error(error.message);
    },

    async read(token) {
      const { data, error } = await client.rpc("read_helper_link", { p_token: token }).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as { ciphertext: string; iv: string; published_at: string };
      return { ciphertext: row.ciphertext, iv: row.iv, publishedAt: row.published_at };
    },
  };
}

/** The daily sweep's part: links that have run out, deleted. Over the admin client only. */
export async function sweepHelperLinks(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc("sweep_helper_links");
  if (error) throw new Error(error.message);
  return data as number;
}
