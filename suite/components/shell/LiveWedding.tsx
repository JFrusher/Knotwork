"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { browserClient } from "@/lib/accounts/browserClient";
import { followWedding, pageName, type Following } from "@/lib/documents/live";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";

/**
 * Follows the account's copy of the wedding live, in place of polling it: a
 * save from anywhere — a partner, the planner, another tab — is heard the
 * moment it lands, and merged in as any pull is. It also says which page
 * this window is on, for the others to see.
 *
 * Only for a wedding on an account, with somebody signed in: there is no
 * other copy to follow otherwise.
 */
export function LiveWedding() {
  const weddingId = useTrousseauStore((s) => s.weddingId);
  const pathname = usePathname();
  const following = useRef<Following | null>(null);
  const where = useRef(pageName(pathname));
  where.current = pageName(pathname);

  useEffect(() => {
    const client = browserClient();
    if (!client || !weddingId) return;
    let live: Following | null = null;
    let cancelled = false;
    const pull = () => void useTrousseauStore.getState().pullFromCloud();

    void client.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (cancelled || !email) return;
      live = followWedding(client, weddingId, { email, where: where.current }, {
        // Its own saves come back too, already agreed on.
        onMoved: (version) => {
          if (version !== useTrousseauStore.getState().cloudVersion) pull();
        },
        onJoined: pull,
      });
      following.current = live;
    });

    return () => {
      cancelled = true;
      live?.stop();
      following.current = null;
    };
  }, [weddingId]);

  useEffect(() => {
    following.current?.at(pageName(pathname));
  }, [pathname]);

  return null;
}
