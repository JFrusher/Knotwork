import type { Metadata } from "next";
import Link from "next/link";
import { DrinksCalculator } from "@/components/bar/DrinksCalculator";

export const metadata: Metadata = {
  title: "Wedding drinks calculator",
  description: "How much fizz, wine, beer, spirits, soft drinks and ice to buy for your wedding, in bottles and cases, with what it costs.",
  alternates: { canonical: "/calculators/drinks" },
};

/**
 * Outside the app's route group, like the blog: no wedding, no account, and a
 * search engine finds a working page. The sums are the Bar's own.
 */
export default function DrinksCalculatorPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl">Wedding drinks calculator</h1>
      <p className="mt-4 max-w-2xl text-slate">
        Type how many are coming and change any figure: the amounts are worked out in UK bottles and cases as you go. Add a
        price to a line to see what it costs. Nothing you type is kept or sent anywhere.{" "}
        <Link href="/blog/how-much-drink-for-a-uk-wedding" className="underline underline-offset-2 hover:text-charcoal">
          How the numbers are worked out
        </Link>
        .
      </p>
      <DrinksCalculator />
    </main>
  );
}
