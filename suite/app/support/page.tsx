import type { Metadata } from "next";
import Link from "next/link";
import { KO_FI_URL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Support",
  description: "Trousseau is free and stays free. A tip helps keep the hosted copy running.",
  alternates: { canonical: "/support" },
};

/**
 * Outside the app's route group, like the privacy and terms pages: anyone can
 * read it, with or without a wedding in their browser.
 */
export default function Support() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <p className="text-sm tracking-[0.14em] text-slate uppercase">Trousseau</p>
      <h1 className="mt-3 text-3xl">Support Trousseau</h1>

      <p className="mt-6 text-slate">
        Trousseau is free, and it will stay free. Every tool works in full without an account or a
        payment, and nothing will ever be put behind one.
      </p>

      <section className="mt-8">
        <h2 className="text-xl">What a tip pays for</h2>
        <p className="mt-3 text-slate">
          The hosted copy you can open without installing anything, the database behind accounts and
          syncing between partners, and the time spent fixing what people report.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">How</h2>
        <p className="mt-3 text-slate">
          A one-off tip on Ko-fi. There is no subscription and no supporter tier: a tip changes
          nothing about what you can use, for you or for anyone else.
        </p>
        <p className="mt-5">
          <a
            href={KO_FI_URL}
            className="inline-flex min-h-11 items-center rounded border border-gold bg-gold/15 px-4 text-sm text-charcoal transition hover:bg-gold/25"
          >
            Buy us a coffee on Ko-fi
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">Other ways to help</h2>
        <p className="mt-3 text-slate">
          Tell another couple about it. Report a bug on{" "}
          <a
            href="https://github.com/JFrusher/Trousseau/issues"
            className="underline underline-offset-2 hover:text-charcoal"
          >
            GitHub
          </a>{" "}
          — a description or a screenshot with names blurred, never your real guest list. Or run a
          copy of your own; that is supported too.
        </p>
      </section>

      <p className="mt-12 border-t border-stone pt-6 text-sm">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal"
        >
          Back to Trousseau
        </Link>
      </p>
    </main>
  );
}
