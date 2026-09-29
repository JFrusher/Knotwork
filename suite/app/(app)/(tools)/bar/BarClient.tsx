"use client";

import dynamic from "next/dynamic";

/**
 * The Bar, split out of the main bundle, as Boxes is: this file exists only
 * because `next/dynamic(..., { ssr: false })` is a Client Component API and
 * `page.tsx` has to stay a Server Component to keep its `metadata`.
 */
const BarBoard = dynamic(() => import("@/components/bar/BarBoard").then((m) => m.BarBoard), { ssr: false });

export function BarClient() {
  return <BarBoard />;
}
