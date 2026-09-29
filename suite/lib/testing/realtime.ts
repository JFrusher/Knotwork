import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import type { Here } from "@/lib/documents/live";

/** A Supabase client with one channel, whose events a test raises by hand. */
export function fakeClient(email: string | null = "alex@example.com") {
  const on: { moved?: (message: { payload: unknown }) => void; sync?: () => void; status?: (status: string) => void } = {};
  let present: Record<string, Here[]> = {};
  const channel = {
    on(type: string, _filter: unknown, handler: never) {
      if (type === "broadcast") on.moved = handler;
      else on.sync = handler;
      return channel;
    },
    subscribe(handler: (status: string) => void) {
      on.status = handler;
      return channel;
    },
    track: vi.fn(async () => "ok"),
    presenceState: () => present,
  };
  const client = {
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => "ok"),
    auth: { getUser: async () => ({ data: { user: email ? { email } : null } }) },
  };
  return {
    client: client as unknown as SupabaseClient & typeof client,
    channel,
    joined: () => on.status!("SUBSCRIBED"),
    moved: (version: number) => on.moved!({ payload: { version } }),
    present: (state: Record<string, Here[]>) => {
      present = state;
      on.sync!();
    },
  };
}
