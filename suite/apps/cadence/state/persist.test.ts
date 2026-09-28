// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { sampleDoc } from "../core/model/defaults";
import { createPersister, persist, restore } from "./persist";

/**
 * The autosave goes into the shared wedding, not a key of the tool's own, so
 * these assert against the `timeline` slice.
 */
const slice = () =>
  (useTrousseauStore.getState().raw as Record<string, unknown>)["timeline"] as
    | Record<string, unknown>
    | undefined;

beforeEach(() => {
  // The store refuses writes until the stored wedding has been read, which is
  // the only state a tool ever runs in — `WhenDocumentReady` holds it back until
  // then. Starting from an unread store would test a situation that cannot
  // happen and quietly pass, because every write would be dropped.
  useTrousseauStore.getState().replaceDocument({});
  // Replacing the document is what a restore from file does, and a tool always
  // re-reads after one — it is remounted so that it does. Without that read
  // here, the writes below are correctly refused as coming from a tool holding
  // a wedding that has been thrown away.
  restore();
});

describe("restore", () => {
  it("gives an empty day when nothing is saved", () => {
    // An empty wedding is a readable one, so this is a day with no blocks in it.
    expect(restore().blocks).toEqual([]);
  });

  it("brings back the saved day", () => {
    persist(sampleDoc());
    const doc = restore();
    expect(doc.blocks.map((b) => b.label)).toEqual(sampleDoc().blocks.map((b) => b.label));
    expect(doc.lanes).toEqual(sampleDoc().lanes);
  });
});

describe("createPersister", () => {
  it("writes once after the edits stop", () => {
    vi.useFakeTimers();
    const { schedule } = createPersister();

    schedule(sampleDoc());
    schedule(sampleDoc());
    schedule(sampleDoc());
    expect(slice()?.["blocks"]).toBeUndefined();

    vi.advanceTimersByTime(500);
    expect((slice()?.["blocks"] as unknown[]).length).toBe(sampleDoc().blocks.length);

    vi.useRealTimers();
  });

  it("flushes on demand", () => {
    vi.useFakeTimers();
    const { schedule, flush } = createPersister();
    schedule(sampleDoc());
    flush();
    expect((slice()?.["blocks"] as unknown[]).length).toBe(sampleDoc().blocks.length);
    vi.useRealTimers();
  });
});
