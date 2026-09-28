"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The record a link asks a tool to open on — `?select=<id>` — selected once
 * the tool has loaded, and then taken out of the address so a reload does not
 * select it again.
 *
 * Called by each tool after it loads its document, so the selection lands on
 * what was loaded rather than being cleared by the load. Watches the address
 * rather than reading it once, because the command palette can ask the tool
 * already on screen for another record, and that is not a new mount.
 */
export function useSelectFromAddress(select: (id: string) => void) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("select");

  useEffect(() => {
    if (!id) return;
    select(id);
    const rest = new URLSearchParams(params);
    rest.delete("select");
    router.replace(rest.size > 0 ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [id, params, pathname, router, select]);
}
