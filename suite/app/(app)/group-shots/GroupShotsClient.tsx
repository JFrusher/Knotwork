"use client";

import dynamic from "next/dynamic";

/**
 * Group shots, split out of the main bundle.
 *
 * It is already a self-contained client component with no scoped CSS and no
 * `WhenDocumentReady`-style readiness gate to carry over — this file exists
 * only because `next/dynamic(..., { ssr: false })` is a Client Component API,
 * and `page.tsx` has to stay a Server Component to keep its `metadata` export.
 */
const GroupShotsBoard = dynamic(
  () => import("@/components/group-shots/GroupShotsBoard").then((m) => m.GroupShotsBoard),
  { ssr: false },
);

export function GroupShotsClient() {
  return <GroupShotsBoard />;
}
