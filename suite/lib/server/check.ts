import type { z } from "zod";

interface Checked<T> {
  ok: true;
  value: T;
}

interface Failed {
  ok: false;
  error: string;
}

/**
 * A request body against its schema: the value, or the first thing wrong with
 * it, in words a person can act on. Shape complaints only — nothing here says
 * whether what was asked for exists.
 */
export function check<T>(schema: z.ZodType<T>, value: unknown): Checked<T> | Failed {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  const issue = result.error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return { ok: false, error: `${where}${issue?.message ?? "Malformed request."}` };
}
