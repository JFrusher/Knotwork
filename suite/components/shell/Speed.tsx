"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { countedUrl } from "@/lib/pageCounts";

/** Hosted performance telemetry, with each address cut to its route first. */
export function Speed() {
  return <SpeedInsights beforeSend={(event) => ({ ...event, url: countedUrl(event.url) })} />;
}
