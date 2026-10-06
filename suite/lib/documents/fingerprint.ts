/**
 * A short, stable content hash — not cryptographic, just cheap and collision-
 * unlikely enough to tell "this slice changed" from "this slice didn't,"
 * which is all the merge in mergeCloudDocument.ts needs it for.
 */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value ?? null);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}:${text.length.toString(16)}`;
}
