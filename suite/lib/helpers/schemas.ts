import { z } from "zod";

const base64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** One helper's sheet is small; a ceiling, not a target. */
const MAX_CIPHERTEXT = 200_000;

const personId = z.string().min(1).max(100);

export const publishSchema = z.strictObject({
  weddingId: z.uuid("That is not a wedding."),
  personId,
  // 32 bytes, base64url, unpadded — as the guest link's.
  key: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "That is not a link key."),
  ciphertext: z.string().min(1).max(MAX_CIPHERTEXT).regex(base64, "That is not sealed."),
  iv: z.string().min(1).max(32).regex(base64, "That is not sealed."),
  fingerprint: z.string().min(1).max(64),
});

export const takeDownSchema = z.strictObject({ weddingId: z.uuid("That is not a wedding."), personId });

/** 128 bits, hex: what `publish_helper_link` makes. */
export const tokenSchema = z.string().regex(/^[0-9a-f]{32}$/, "That is not a helper's link.");

/** The decrypted sheet, shared by its producer and online/offline readers. */
export const helperSheetSchema = z.object({
  wedding: z.object({ names: z.string(), date: z.union([z.literal(""), z.iso.date()]), venue: z.string() }),
  helper: z.object({ name: z.string(), team: z.string() }),
  day: z.array(z.object({ label: z.string(), when: z.string(), where: z.string() })),
  jobs: z.array(z.object({ label: z.string(), when: z.string(), where: z.string(), who: z.array(z.string()) })),
  boxes: z.array(z.object({ number: z.number(), name: z.string(), where: z.string(), items: z.array(z.string()), takenBy: z.array(z.string()) })),
  shots: z.array(z.object({ section: z.string(), shots: z.array(z.object({ label: z.string(), names: z.array(z.string()) })) })),
  crew: z.array(z.object({ name: z.string(), role: z.string(), phone: z.string() })),
});

export const keptHelperSheetSchema = z.object({
  sheet: helperSheetSchema,
  publishedAt: z.iso.datetime({ offset: true }),
});
