import type { Metadata } from "next";
import { Overview } from "@/components/shell/Overview";
import { Countdown } from "@/components/shell/Countdown";
import { WeddingPack } from "@/components/shell/WeddingPack";
import { ExampleBanner } from "@/components/shell/ExampleBanner";
import { FrontPage } from "@/components/shell/FrontPage";
import { FortnightCard } from "@/components/shell/FortnightCard";

export const metadata: Metadata = {
  // `absolute` so the root template does not append the suffix to the name it
  // is a suffix of.
  title: { absolute: "Knotwork" },
  description: "Seating, stationery, timeline and crew for one wedding.",
};

/**
 * The wedding at a glance — or, while there is no wedding yet, the welcome.
 *
 * Someone with a wedding opens this page to find out where things stand, so
 * that is what it answers: no pitch, the promises about nothing being uploaded
 * kept in the Data panel next to the buttons they describe. Someone with
 * nothing in it yet has a different question — what is this, and how do I try
 * it? — and gets `Welcome` until anything is in the wedding (see `FrontPage`).
 */
export default function Home() {
  return (
    <FrontPage
      dashboard={
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
          <ExampleBanner />
          <Countdown />
          <FortnightCard />

          <Overview />

          <section id="wedding-pack" className="mt-12">
            <WeddingPack />
          </section>
        </div>
      }
    />
  );
}
