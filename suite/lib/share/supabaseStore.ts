import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareStore } from "./store";

/** Over a caller-scoped client: RLS and the functions see the real caller. */
export function shareStore(client: SupabaseClient): ShareStore {
  return {
    async linkOf(weddingId) {
      const { data, error } = await client
        .from("wedding_shares")
        .select("token, share_key, show_plan, fingerprint, published_at")
        .eq("wedding_id", weddingId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        token: data.token as string,
        key: data.share_key as string,
        showPlan: data.show_plan as boolean,
        fingerprint: data.fingerprint as string,
        publishedAt: data.published_at as string,
      };
    },

    async publish(weddingId, input) {
      const { data, error } = await client
        .rpc("publish_share", {
          p_wedding_id: weddingId,
          p_share_key: input.key,
          p_show_plan: input.showPlan,
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

    async takeDown(weddingId) {
      const { error } = await client.rpc("take_down_share", { p_wedding_id: weddingId });
      if (error) throw new Error(error.message);
    },

    async read(token) {
      const { data, error } = await client.rpc("read_share", { p_token: token }).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as { ciphertext: string; iv: string } | null) ?? null;
    },
  };
}
