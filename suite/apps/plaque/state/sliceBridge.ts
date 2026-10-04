import { useKnotworkStore, type WriteOptions } from "@/lib/store/useKnotworkStore";
import { designFor, initialSuite, withDesign, type Design, type Suite } from "./design";
import { load, VERSION } from "./persist";

/**
 * Where Place cards' designs live: the `stationery` slice of the shared
 * wedding, so they travel with the backup, the sync and everything else.
 *
 * Plaque keeps no copy of them. Its store shows one piece of this slice, and
 * every design edit is written here first, on the wedding's one history.
 */

/** The suite the wedding holds — the starting one when it has none — and why, when some or all of it could not be read. */
export function readSuite(raw: Record<string, unknown>): { suite: Suite; problem: string | null } {
  const result = load(raw["stationery"]);
  if (result.status === "ok") {
    const { version: _version, savedAt: _savedAt, ...suite } = result.data;
    return { suite, problem: result.problem };
  }
  return { suite: initialSuite(), problem: result.status === "discarded" ? `${result.reason} Starting fresh.` : null };
}

export function writeSuite(suite: Suite, options: WriteOptions): void {
  useKnotworkStore
    .getState()
    .setSlice("stationery", { version: VERSION, savedAt: new Date().toISOString(), ...suite }, options);
}

/** `pieceId` when the suite still has it, otherwise its first piece. */
export function resolvePieceId(suite: Suite, pieceId: string | null): string {
  return suite.pieces.some((p) => p.id === pieceId) ? pieceId! : suite.pieces[0]!.id;
}

/** One piece of the wedding's stationery as the editor sees it. */
export function readDesign(
  raw: Record<string, unknown>,
  pieceId: string | null,
): { design: Design; pieceId: string; suite: Suite; problem: string | null } {
  const { suite, problem } = readSuite(raw);
  const resolved = resolvePieceId(suite, pieceId);
  return { design: designFor(suite, resolved), pieceId: resolved, suite, problem };
}

/** Writes the editor's view of one piece back into the wedding. */
export function writeDesign(design: Design, pieceId: string, options: WriteOptions): void {
  const { suite } = readSuite(useKnotworkStore.getState().raw);
  writeSuite(withDesign(suite, pieceId, design), options);
}
