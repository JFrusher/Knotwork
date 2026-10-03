import { useKnotworkStore, type WriteOptions } from "@/lib/store/useKnotworkStore";
import { initialDesign, type Design } from "./design";
import { load, VERSION } from "./persist";

/**
 * Where Place cards' design lives: the `stationery` slice of the shared
 * wedding, so it travels with the backup, the sync and everything else.
 *
 * Plaque keeps no copy of it. Its store shows what this slice holds, and every
 * design edit is written here first, on the wedding's one history.
 */

/** The design the wedding holds — the starting one when it has none — and why, when it could not be read. */
export function readDesign(raw: Record<string, unknown>): { design: Design; problem: string | null } {
  const result = load(raw["stationery"]);
  if (result.status === "ok") {
    const { version: _version, savedAt: _savedAt, ...design } = result.data;
    return { design, problem: null };
  }
  return { design: initialDesign(), problem: result.status === "discarded" ? `${result.reason} Starting fresh.` : null };
}

export function writeDesign(design: Design, options: WriteOptions): void {
  useKnotworkStore
    .getState()
    .setSlice("stationery", { version: VERSION, savedAt: new Date().toISOString(), ...design }, options);
}
