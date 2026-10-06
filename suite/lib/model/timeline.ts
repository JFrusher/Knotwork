/**
 * The editable timeline: Cadence's own document, unchanged.
 *
 * This module used to carry a trimmed copy of Cadence's model. It now re-exports
 * the real one from `apps/cadence/core`, so the scheduling resolver, the clash
 * checks, the solar calculation and all five printed pieces consume exactly the
 * document they were written against — rather than a lookalike that has to be
 * kept in step by hand.
 *
 * The slice holds the *source*: anchors, gaps and squeeze floors, before
 * anything is worked out. The envelope's `day` slice is the resolved
 * publication (`kind: "cadence.day"`) that the delegation board and any outside
 * reader consume. Both are kept, and only the first can be edited.
 *
 * `timeline` is now one of the contract package's `SLICE_NAMES` — it carries no
 * schema of its own there beyond "an object", exactly like `crew` and
 * `stationery`. This module is still where the suite's own richer, editable
 * shape lives.
 */

export type { OutputSpec, TimelineDoc } from "@/apps/cadence/core/model/types";

/**
 * What the rest of the suite calls the timeline.
 *
 * An alias rather than a second interface: every consumer wants the whole
 * document, and a narrower type here would only mean casting at each use.
 */
export type { TimelineDoc as Timeline } from "@/apps/cadence/core/model/types";
