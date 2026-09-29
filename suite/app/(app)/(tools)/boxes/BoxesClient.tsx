"use client";

import dynamic from "next/dynamic";

/**
 * Boxes, split out of the main bundle, as Ceremony is: this file exists only
 * because `next/dynamic(..., { ssr: false })` is a Client Component API and
 * `page.tsx` has to stay a Server Component to keep its `metadata`.
 */
const BoxesBoard = dynamic(() => import("@/components/boxes/BoxesBoard").then((m) => m.BoxesBoard), { ssr: false });

export function BoxesClient() {
  return <BoxesBoard />;
}
