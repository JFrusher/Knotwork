import { emptyTrousseau, migrate } from "@jfrusher/trousseau";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import type { TimelineDoc } from "../core/model/types";
import { useStore } from "./store";

/**
 * For tests: a wedding whose day is `timeline`, open and ready, with nothing
 * to undo. The wedding's own date, names and times are the day's, since the
 * envelope's copy is the one Timeline reads.
 */
export function openDay(timeline: TimelineDoc): void {
  const base = emptyTrousseau();
  const { date, coupleNames, venueName, curfewMin, utcOffsetMin } = timeline.day;
  const raw = { ...base, event: { ...base.event, date, coupleNames, venueName, curfewMin, utcOffsetMin }, timeline };
  useTrousseauStore.setState({
    status: "ready",
    raw: raw as unknown as Record<string, unknown>,
    doc: migrate(raw),
    past: [],
    future: [],
  });
  useStore.setState({ selectedId: null, preview: null, notice: null });
}
