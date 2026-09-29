"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { TOOLS, WEDDING_PAGES } from "@/lib/tools";

/**
 * A wedding's live channel: told the moment the account's copy moves, and
 * who else has the wedding open.
 *
 * The database announces every accepted save on the wedding's private
 * channel, by its version alone (see 20260929000003_live_wedding.sql), and
 * only the wedding's members may follow it. So nothing of the wedding goes
 * over this — a window told the version moved fetches the document the way
 * it always has. Presence is each member's email and the window they are in.
 */

/** Someone with the wedding open, and where they are in it. */
export interface Here {
  email: string;
  /** The page's name — "Seating" — or null on one that is not the wedding's. */
  where: string | null;
}

/** Everyone else with this wedding open now: one entry a person, however many windows. */
export const usePresence = create<{ others: Here[] }>(() => ({ others: [] }));

/** The name a page goes by, for saying where someone is. */
export function pageName(pathname: string): string | null {
  return [...WEDDING_PAGES, ...TOOLS].find((page) => page.href === pathname)?.name ?? null;
}

/** Everyone in `state` but `me`, once each, at the page they were last seen on. */
export function othersIn(state: Record<string, Here[]>, me: string): Here[] {
  const byEmail = new Map<string, Here>();
  for (const windows of Object.values(state)) {
    for (const { email, where } of windows) if (email !== me) byEmail.set(email, { email, where });
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export interface Following {
  /** Say this window is now at `where`. */
  at(where: string | null): void;
  stop(): void;
}

/**
 * Join `weddingId`'s channel as `email`, at `where`.
 *
 * `onMoved` hears each announced version. `onJoined` runs on every join,
 * the first and each after a dropped connection, since an announcement made
 * while the window was not listening is not heard again.
 */
export function followWedding(
  client: SupabaseClient,
  weddingId: string,
  me: Here,
  { onMoved, onJoined }: { onMoved: (version: number) => void; onJoined: () => void },
): Following {
  let here = me;
  let channel: RealtimeChannel | null = null;
  let stopped = false;

  // The session's token goes with the join: the channel is private, and the
  // database lets only the wedding's members follow it.
  void client.realtime.setAuth().then(() => {
    if (stopped) return;
    channel = client
      .channel(`wedding:${weddingId}`, { config: { private: true, presence: { key: crypto.randomUUID(), enabled: true } } })
      .on("broadcast", { event: "moved" }, ({ payload }) => onMoved((payload as { version: number }).version))
      .on("presence", { event: "sync" }, () => {
        usePresence.setState({ others: othersIn(channel!.presenceState<Here>(), me.email) });
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void channel!.track(here);
        onJoined();
      });
  });

  return {
    at(where) {
      here = { ...here, where };
      if (channel) void channel.track(here);
    },
    stop() {
      stopped = true;
      if (channel) void client.removeChannel(channel);
      usePresence.setState({ others: [] });
    },
  };
}
