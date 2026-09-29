import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestsPage } from "@/components/guests/GuestsPage";

export const metadata: Metadata = {
  title: "Guests",
  description: "Everyone on the list: replies, sides, food and tables, changed one at a time or many at once.",
};

export default function Guests() {
  // The page reads `?select=` from the address, which waits for the browser.
  return (
    <Suspense>
      <GuestsPage />
    </Suspense>
  );
}
