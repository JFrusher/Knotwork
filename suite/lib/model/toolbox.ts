import type { Trousseau } from "@jfrusher/trousseau";
import { TOOLS, type Tool, type ToolId } from "@/lib/tools";
import { cached } from "./slices";

/**
 * Which tools the wedding shows — the same for both partners and the planner,
 * because it is kept in the wedding, in the `tools` slice.
 *
 * Nothing stored means the five, which is every wedding until somebody adds or
 * removes one. Removing a tool only hides it: what was made in it stays in its
 * own slice, untouched, and is there again when it is added back.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The ids as stored, from a parsed or a raw document, or null when the wedding has never chosen. */
function storedIds(doc: unknown): string[] | null {
  const slice = isRecord(doc) ? doc["tools"] : null;
  const shown = isRecord(slice) ? slice["shown"] : null;
  return Array.isArray(shown) ? shown.filter((id): id is string => typeof id === "string") : null;
}

/** The tools the wedding shows, in the registry's order. */
export function shownTools(doc: Trousseau): readonly Tool[] {
  return cached(doc, "shownTools", () => {
    const ids = storedIds(doc);
    return ids === null ? TOOLS : TOOLS.filter((tool) => ids.includes(tool.id));
  });
}

/** The ids of the tools the wedding has removed, for everything that lists a tool's work. */
export function hiddenToolIds(doc: Trousseau): ReadonlySet<string> {
  return cached(doc, "hiddenToolIds", () => {
    const shown = shownTools(doc);
    return new Set(TOOLS.filter((tool) => !shown.includes(tool)).map((tool) => tool.id));
  });
}

/**
 * The `tools` slice with one tool added or taken away.
 *
 * Built from the stored document rather than the registry, so an id this build
 * does not know — a tool a newer version added — is kept, and an older build
 * removing Seating never removes the newer one's tool with it.
 */
export function withTool(raw: unknown, id: ToolId, show: boolean): Record<string, unknown> {
  const slice = isRecord(raw) && isRecord(raw["tools"]) ? raw["tools"] : {};
  const others = (storedIds(raw) ?? TOOLS.map((tool) => tool.id)).filter((stored) => stored !== id);
  return { ...slice, shown: show ? [...others, id] : others };
}
