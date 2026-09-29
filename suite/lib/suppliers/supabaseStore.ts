import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupplierStore } from "./store";

/** Over a caller-scoped client: row-level security and the functions see the real caller. */
export function supplierStore(client: SupabaseClient): SupplierStore {
  return {
    async linksOf(weddingId) {
      const { data, error } = await client
        .from("supplier_links")
        .select("team_id, token, share_key, fingerprint, published_at, confirmed_at")
        .eq("wedding_id", weddingId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        teamId: row.team_id as string,
        token: row.token as string,
        key: row.share_key as string,
        fingerprint: row.fingerprint as string,
        publishedAt: row.published_at as string,
        confirmedAt: (row.confirmed_at as string | null) ?? null,
      }));
    },

    async publish(weddingId, input) {
      const { data, error } = await client
        .rpc("publish_supplier_link", {
          p_wedding_id: weddingId,
          p_team_id: input.teamId,
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

    async takeDown(weddingId, teamId) {
      const { error } = await client.rpc("take_down_supplier_link", { p_wedding_id: weddingId, p_team_id: teamId });
      if (error) throw new Error(error.message);
    },

    async read(token) {
      const { data, error } = await client.rpc("read_supplier_link", { p_token: token }).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as { ciphertext: string; iv: string; published_at: string; confirmed_at: string | null };
      return { ciphertext: row.ciphertext, iv: row.iv, publishedAt: row.published_at, confirmedAt: row.confirmed_at };
    },

    async confirm(token) {
      const { data, error } = await client.rpc("confirm_supplier_link", { p_token: token });
      if (error) throw new Error(error.message);
      return (data as string | null) ?? null;
    },
  };
}
