"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { TOOLS } from "@/lib/tools";
import { AccountStatus } from "./AccountStatus";
import { WeddingMenu } from "./WeddingMenu";
import { HowThisWorks } from "./TourButtons";
import { ChromeSlot } from "./chrome";
import { DataButton } from "./DataButton";
import { useDataPanel } from "./dataPanel";
import { useGuestImport } from "./guestImportPanel";
import { useSyncPanel } from "./syncPanel";

const DataManager = dynamic(() => import("./DataManager").then((m) => m.DataManager), {
  ssr: false,
});
const GuestImport = dynamic(() => import("./GuestImport").then((m) => m.GuestImport), {
  ssr: false,
});
const SyncHistory = dynamic(() => import("./SyncHistory").then((m) => m.SyncHistory), {
  ssr: false,
});

/**
 * The one header, on every page.
 *
 * One row, which has to hold the tool's own controls at 1024px, the narrowest
 * width the tools support: Timeline's zoom, Fit day and Present once scrolled
 * out of sight inside it there. So below 1280px the tabs are icons (named for
 * a screen reader and on hover) and the gaps close up. The guest count that
 * used to sit here went for the same room: the front page now says what the
 * tools share, area by area.
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
  // The importer, loaded the same way: only once somebody has asked for it.
  const importOpen = useGuestImport((s) => s.open);
  const [importEverOpened, setImportEverOpened] = useState(false);
  if (importOpen && !importEverOpened) setImportEverOpened(true);
  // Sync & history, loaded the same way; `?panel=sync` opens it on arrival.
  const syncOpen = useSyncPanel((s) => s.open);
  const showSync = useSyncPanel((s) => s.show);
  const hideSync = useSyncPanel((s) => s.hide);
  const [syncEverOpened, setSyncEverOpened] = useState(false);
  if (syncOpen && !syncEverOpened) setSyncEverOpened(true);
  useEffect(() => useSyncPanel.getState().fromAddress(), []);
  // A conflict is settled there, so the button that says so opens it.
  const conflict = useTrousseauStore((s) => s.cloudStatus === "conflict");
  // The one question that stops sync opens the panel that asks it.
  const choosing = useTrousseauStore((s) => s.cloudStatus === "choosing");
  useEffect(() => {
    if (choosing) showData();
  }, [choosing, showData]);
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-parchment/95 backdrop-blur">
        <div className="mx-auto flex h-[var(--shell-header-h)] max-w-7xl items-center gap-2 px-4 xl:gap-3">
          <WeddingMenu />

          {/* Scrolls within the header on a narrow screen, rather than making
              the whole page wider than it and pushing Data off the edge. */}
          <nav aria-label="Tools" className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {TOOLS.map((tool) => {
              const active = pathname === tool.href;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  aria-label={tool.name}
                  title={tool.name}
                  aria-current={active ? "page" : undefined}
                  className={`${tool.tokens} flex shrink-0 items-center rounded-t border-b-2 px-2.5 py-1.5 text-sm whitespace-nowrap transition ${
                    active
                      ? "border-[var(--accent-bright)] bg-stone text-charcoal"
                      : "border-transparent text-slate hover:bg-stone/60 hover:text-charcoal"
                  }`}
                >
                  <tool.icon size={16} aria-hidden className="xl:hidden" />
                  <span className="hidden xl:inline">{tool.name}</span>
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

          <DataButton onOpen={conflict ? showSync : showData} />

          <HowThisWorks />
          <AccountStatus />
        </div>
      </header>

      {dataEverOpened ? <DataManager open={dataOpen} onClose={hideData} /> : null}
      {importEverOpened ? <GuestImport /> : null}
      {syncEverOpened ? <SyncHistory open={syncOpen} onClose={hideSync} /> : null}
    </>
  );
}
