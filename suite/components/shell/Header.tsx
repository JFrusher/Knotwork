"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { TOOLS } from "@/lib/tools";
import { AccountStatus } from "./AccountStatus";
import { HowThisWorks } from "./TourButtons";
import { ChromeSlot } from "./chrome";
import { DataButton } from "./DataButton";
import { useDataPanel } from "./dataPanel";

const DataManager = dynamic(() => import("./DataManager").then((m) => m.DataManager), {
  ssr: false,
});

/**
 * The one header, on every page.
 *
 * The guest count sits in it deliberately: four tools reading one list is the
 * whole point of putting them together, and a number that moves when the
 * seating changes is the cheapest possible proof that they are.
 */
export function Header() {
  const dataOpen = useDataPanel((s) => s.open);
  const showData = useDataPanel((s) => s.show);
  const hideData = useDataPanel((s) => s.hide);
  // DataManager's chunk (CSV and guest-import parsing, the guest link panel)
  // is dynamically imported — keep it out of the tree entirely until the user
  // has opened it once, so the chunk isn't fetched on every route's first
  // render. Once opened, its dialog element stays mounted and is opened and
  // closed in place.
  const [dataEverOpened, setDataEverOpened] = useState(false);
  if (dataOpen && !dataEverOpened) setDataEverOpened(true);
  const pathname = usePathname();
  const guestCount = useTrousseauStore((s) => Object.keys(s.doc.guests).length);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-parchment/95 backdrop-blur">
        <div className="mx-auto flex h-[var(--shell-header-h)] max-w-7xl items-center gap-2 px-4 sm:gap-6">
          <Link href="/" className="shrink-0 font-display text-xl text-charcoal">
            Trousseau
          </Link>

          {/* Scrolls within the header on a narrow screen, rather than making
              the whole page wider than it and pushing Data off the edge. */}
          <nav aria-label="Tools" className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {TOOLS.map((tool) => {
              const active = pathname === tool.href;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  aria-current={active ? "page" : undefined}
                  className={`${tool.tokens} shrink-0 rounded-t border-b-2 px-2.5 py-1.5 text-sm whitespace-nowrap transition ${
                    active
                      ? "border-[var(--accent-bright)] bg-stone text-charcoal"
                      : "border-transparent text-slate hover:bg-stone/60 hover:text-charcoal"
                  }`}
                >
                  {tool.name}
                </Link>
              );
            })}
          </nav>

          {/*
            * The tool on screen fills these. Undo belongs to whichever tool you
            * are editing in — it is the only thing that knows what your last
            * change was — and its document controls sit beside it rather than
            * on a second bar of their own.
            *
            * `safe` end alignment: plain `justify-end` pushes overflow out of
            * the start edge, where no scrollbar can reach it, and Timeline's
            * zoom and Present buttons sat there invisible at 1440px.
            */}
          <div className="flex min-w-0 flex-1 items-center justify-end-safe gap-1 overflow-x-auto [&_button]:whitespace-nowrap [&>*]:shrink-0">
            <ChromeSlot name="tool-actions" />
          </div>
          <div className="hidden shrink-0 items-center sm:flex">
            <ChromeSlot name="tool-undo" />
          </div>

          <span
            title={`${guestCount} guests on this device`}
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-charcoal/10 bg-stone px-2.5 py-1 text-xs text-slate sm:inline-flex"
          >
            <Users size={13} />
            {guestCount}
          </span>

          <DataButton onOpen={showData} />

          <HowThisWorks />
          <AccountStatus />
        </div>
      </header>

      {dataEverOpened ? <DataManager open={dataOpen} onClose={hideData} /> : null}
    </>
  );
}
