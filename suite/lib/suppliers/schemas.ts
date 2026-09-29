import { z } from "zod";

const base64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** One supplier's sheet is small; a ceiling, not a target. */
const MAX_CIPHERTEXT = 200_000;

const teamId = z.string().min(1).max(100);

export const publishSchema = z.strictObject({
  weddingId: z.uuid("That is not a wedding."),
  teamId,
  // 32 bytes, base64url, unpadded — as the guest link's.
  key: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "That is not a link key."),
  ciphertext: z.string().min(1).max(MAX_CIPHERTEXT).regex(base64, "That is not sealed."),
  iv: z.string().min(1).max(32).regex(base64, "That is not sealed."),
  fingerprint: z.string().min(1).max(64),
});

export const takeDownSchema = z.strictObject({ weddingId: z.uuid("That is not a wedding."), teamId });

/** 128 bits, hex: what `publish_supplier_link` makes. */
export const tokenSchema = z.string().regex(/^[0-9a-f]{32}$/, "That is not a supplier's link.");
