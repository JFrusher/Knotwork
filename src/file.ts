import { ZodError } from "zod";
import { KNOTWORK_KIND, LEGACY_KINDS, migrate, type Knotwork } from "./envelope.js";

export const KNOTWORK_EXTENSION = ".knotwork.json";

/** Indented and newline-terminated: these files end up in git and in email. */
export function serialise(doc: Knotwork): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

/**
 * Read a `.knotwork.json`.
 *
 * Throws with a sentence a person can act on rather than a validation dump.
 * This runs on whatever the user dropped on the window, which is often the
 * wrong file entirely — most usefully, one of the four apps' own save files.
 */
export function parse(text: string): Knotwork {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON. Is it a Knotwork file?");
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("That file is not a Knotwork file.");
  }

  const kind = (raw as Record<string, unknown>)["kind"];
  if (kind !== undefined && kind !== KNOTWORK_KIND && !LEGACY_KINDS.includes(String(kind))) {
    throw new Error(
      `That is not a Knotwork file — it says it is a "${String(kind)}".`,
    );
  }

  try {
    return migrate(raw);
  } catch (cause) {
    throw new Error(`That Knotwork file could not be read: ${firstIssue(cause)}`, { cause });
  }
}

/** `charis-and-jacob.knotwork.json`, or a sensible fallback. */
export function suggestedFilename(doc: Knotwork): string {
  const slug = doc.event.coupleNames
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "wedding"}${KNOTWORK_EXTENSION}`;
}

/** The most useful line out of a validation failure, for a person rather than a log. */
function firstIssue(cause: unknown): string {
  if (cause instanceof ZodError) {
    const issue = cause.issues[0];
    if (issue) {
      const where = issue.path.join(".");
      return where ? `${where}: ${issue.message}` : issue.message;
    }
  }
  return "it does not match the expected shape.";
}
