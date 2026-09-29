"use client";

import dynamic from "next/dynamic";

/**
 * Ceremony, split out of the main bundle, as Group shots is: this file exists
 * only because `next/dynamic(..., { ssr: false })` is a Client Component API
 * and `page.tsx` has to stay a Server Component to keep its `metadata`.
 */
const CeremonyBoard = dynamic(() => import("@/components/ceremony/CeremonyBoard").then((m) => m.CeremonyBoard), {
  ssr: false,
});

export function CeremonyClient() {
  return <CeremonyBoard />;
}
