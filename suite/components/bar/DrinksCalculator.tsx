"use client";

import Link from "next/link";
import { useState } from "react";
import { barHref, calculatorSum, startingBar } from "@/lib/bar/calculator";
import { BarSheet } from "./BarBoard";

/** The Bar's sheet, held in this page alone: nothing is stored, nothing leaves it. */
export function DrinksCalculator() {
  const [bar, setBar] = useState(startingBar);
  return (
    <>
      <div className="mt-8 flex flex-col rounded-lg border border-stone lg:flex-row">
        <BarSheet bar={bar} sum={calculatorSum(bar)} doc={null} coupleNames="" write={setBar} />
      </div>
      <p className="mt-6">
        <Link href={barHref(bar)} className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-charcoal">
          Use these figures in your own wedding&rsquo;s Bar
        </Link>
      </p>
    </>
  );
}
