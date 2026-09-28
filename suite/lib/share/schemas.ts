import { z } from "zod";

const base64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Generous for a guest list with the room drawn; a ceiling, not a target. */
const MAX_CIPHERTEXT = 2_000_000;

export const publishSchema = z.strictObject({
  weddingId: z.uuid("That is not a wedding."),
  // 32 bytes, base64url, unpadded.
  key: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "That is not a link key."),
  showPlan: z.boolean(),
  ciphertext: z.string().min(1).max(MAX_CIPHERTEXT).regex(base64, "That is not sealed."),
  iv: z.string().min(1).max(32).regex(base64, "That is not sealed."),
  fingerprint: z.string().min(1).max(64),
});

export const takeDownSchema = z.strictObject({ weddingId: z.uuid("That is not a wedding.") });

/** 128 bits, hex: what `publish_share` makes. */
export const tokenSchema = z.string().regex(/^[0-9a-f]{32}$/, "That is not a guest link.");
