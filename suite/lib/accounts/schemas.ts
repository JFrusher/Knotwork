import { z } from "zod";
export { check } from "@/lib/server/check";

export const inviteSchema = z.object({
  weddingId: z.uuid("That is not a wedding."),
  email: z.email("That does not look like an email address."),
  role: z.enum(["partner", "planner", "assistant"], "A role is partner, planner or assistant."),
});

/** Nobody starts a wedding as an assistant: they are always invited onto one. */
export const newWeddingSchema = z.object({ role: z.enum(["partner", "planner"], "A role is partner or planner.") });

export const removeMemberSchema = z.object({
  weddingId: z.uuid("That is not a wedding."),
  userId: z.uuid("That is not a person."),
});

/** Token from `create_invite`: two concatenated UUIDs with hyphens stripped. 64 hex characters. */
export const tokenSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-f0-9]+$/, "That is not an invite token.");
