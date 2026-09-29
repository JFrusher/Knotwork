"use client";

import { Analytics } from "@vercel/analytics/next";
import { countedUrl } from "@/lib/pageCounts";

/** Cookieless page counts on the hosted instance, each address cut to its route first. */
export function PageCounts() {
  return <Analytics beforeSend={(event) => ({ ...event, url: countedUrl(event.url) })} />;
}
