import type { Metadata } from "next";
import { Overview } from "@/components/shell/Overview";
import { Countdown } from "@/components/shell/Countdown";
import { WeddingPack } from "@/components/shell/WeddingPack";
import { SetupPrompt } from "@/components/shell/SetupPrompt";

export const metadata: Metadata = {
  // `absolute` so the root template does not append the suffix to the name it
  // is a suffix of.
  title: { absolute: "Trousseau" },
  description: "Seating, stationery, timeline and crew for one wedding.",
};

/**
 * The wedding at a glance.
 *
 * This page used to sell the app: a headline, three columns about local-first
 * storage, a licence. That was written for someone deciding whether to use it.
 * There is one person using it, they decided, and they now open this page to
 * find out where things stand — so it answers that instead.
 *
 * What was true in the pitch has not been deleted so much as demoted: the
 * promises about nothing being uploaded are kept where they are actually load
 * bearing, in the Data panel, next to the buttons they describe.
 */
export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <Countdown />
      <SetupPrompt />

      <Overview />

      <section className="mt-12">
        <WeddingPack />
      </section>
    </div>
  );
}
