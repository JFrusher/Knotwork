import type { TimelineDoc } from "../core/model/types";

/** Every blob-store key a document depends on. */
export function referencedKeys(doc: TimelineDoc): string[] {
  const keys = doc.fonts.map((font) => font.blobKey);
  if (doc.day.logoKey) keys.push(doc.day.logoKey);
  return [...new Set(keys)];
}
