"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { useWeddings } from "@/lib/store/weddings";
import { WEDDING_PAGES } from "@/lib/tools";
import type { WeddingListing } from "@/lib/accounts/handlers";

function weddingLabel(wedding: WeddingListing): string {
  return `${wedding.names || "A wedding with no names yet"}${wedding.role === "planner" ? " · client" : ""}`;
}

const item =
  "flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-slate transition hover:bg-stone hover:text-charcoal aria-[current]:bg-stone aria-[current]:text-charcoal";

/**
 * The wedding's name, at the head of every page, and what sits under it: the
 * wedding's own pages, and — for an account on more than one wedding, which in
 * practice is a planner — the others.
 *
 * The name takes the wordmark's place. It is the one thing on every screen
 * that says which wedding this is, which matters most to somebody with a
 * dozen of them, and it is set in the display face the design keeps for it.
 *
 * Another wedding opens by a full load of `/open/<id>`, never a change in
 * place: see that page for why. So those are plain links, not `Link`s.
 */
export function WeddingMenu() {
  const title = useKnotworkStore((s) => s.doc.event.coupleNames);
  const current = useKnotworkStore((s) => s.weddingId);
  const weddings = useWeddings((s) => s.weddings);
  const pathname = usePathname();
  const planning = weddings !== null && (weddings.length > 1 || weddings.some((w) => w.role === "planner"));

  return (
    <Popover
      label={
        <>
          <span className="truncate">{title || "Knotwork"}</span>
          <ChevronDown size={15} className="shrink-0 text-slate" aria-hidden />
        </>
      }
      buttonClassName="flex max-w-48 shrink-0 items-center gap-1 font-display text-xl text-charcoal"
    >
      <nav aria-label="This wedding">
        <ul>
          {WEDDING_PAGES.map((page) => (
            <li key={page.href}>
              <Link href={page.href} aria-current={pathname === page.href ? "page" : undefined} className={item}>
                <page.icon size={15} aria-hidden />
                {page.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {planning ? (
        <nav aria-label="Your weddings" className="mt-2 border-t border-charcoal/10 pt-2">
          <ul>
            {weddings.map((wedding) => (
              <li key={wedding.weddingId}>
                <a
                  href={`/open/${wedding.weddingId}`}
                  aria-current={wedding.weddingId === current ? "true" : undefined}
                  className={item}
                >
                  <span className="truncate">{weddingLabel(wedding)}</span>
                </a>
              </li>
            ))}
            <li>
              <Link href="/weddings" className={item}>
                All weddings
              </Link>
            </li>
            <li>
              <Link href="/library" aria-current={pathname === "/library" ? "page" : undefined} className={item}>
                Library
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </Popover>
  );
}
