import type { TimelineDoc } from "../core/model/types";
import { readSlice, writeSlice } from "./sliceBridge";

const DEBOUNCE_MS = 400;

/** The day as the shared wedding holds it. Always readable: an empty wedding gives an empty day. */
export function restore(): TimelineDoc {
  return readSlice();
}

/** Into the shared wedding, so the day travels with the backup and the sync. */
export function persist(doc: TimelineDoc): void {
  writeSlice(doc);
}

/**
 * Debounced writer. Returns a flush for the cases that cannot wait, such as
 * the page going away.
 */
export function createPersister() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: TimelineDoc | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      persist(pending);
      pending = null;
    }
  };

  const schedule = (doc: TimelineDoc) => {
    pending = doc;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  };

  return { schedule, flush };
}
