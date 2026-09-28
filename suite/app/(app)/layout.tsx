import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { StoreHydrator } from "@/lib/store/StoreHydrator";
import { GuestLinkKeeper } from "@/components/shell/GuestLinkKeeper";
import { TourProvider } from "@/lib/tour/useTour";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { ConfirmProvider } from "@/components/ui/Confirm";

/**
 * The planning application: the header, the tools, and the local document.
 *
 * A route group rather than the root layout, so the guest-facing pages under
 * `/seat` genuinely sit outside it. A nested layout would have added to the
 * root's chrome rather than replacing it, and a guest would have been offered a
 * Seating tab that opens whatever wedding happens to be in *their* browser.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // `--shell-header-h` is read by the header itself and by any tool that wants
    // to fill what is left of the viewport, so the two can never disagree.
    <div className="[--shell-header-h:3.5rem]">
      <StoreHydrator />
      <GuestLinkKeeper />
      {/* One confirmation dialog for the whole app — see `components/ui/Confirm`. */}
      <ConfirmProvider>
        {/* Above the route content, so a chapter that walks from Seating to
            Timeline keeps its place across the navigation. */}
        <TourProvider>
          {/* Before the header, so it is the first thing Tab reaches. */}
          <a
            href="#main"
            className="sr-only z-50 rounded bg-parchment px-3 py-2 text-sm text-charcoal focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Skip to content
          </a>
          <Header />
          {/* The page's one main landmark. The tools and pages inside render into
              it rather than each bringing their own, which put two mains, or
              none, on a page. */}
          <main id="main">{children}</main>
          <Footer />
          <TourOverlay />
        </TourProvider>
      </ConfirmProvider>
    </div>
  );
}
