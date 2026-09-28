/**
 * A fixed-window rate limiter, in memory.
 *
 * This is a public URL that anyone who finds the domain can reach. Without a
 * limit, a signed-in stranger could create weddings, send invites and write
 * documents as fast as the network allows, and every one costs the server.
 * Keyed by account, so two couples behind one office network never share a
 * budget.
 *
 * ponytail: in memory, so the window is per serverless instance rather than
 * global, and a determined attacker gets one window per instance Vercel happens
 * to spin up. That is a genuine ceiling, not a pretence: it turns an
 * unthrottled attack into a slow one. If this ever needs to be exact, move the
 * counter into Postgres — the table and the transaction are the easy part.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Stop the map growing without bound on a long-lived instance. */
function sweep(now: number): void {
  if (windows.size < 5000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface Limit {
  /** How many requests are allowed in the window. */
  max: number;
  windowMs: number;
}

/** Creating weddings: rare, and the most expensive thing a stranger can do. */
export const CREATE_LIMIT: Limit = { max: 5, windowMs: 60 * 60 * 1000 };

/** Sending an invite email. Same budget shape as CREATE_LIMIT, named for what it guards: an outbound email send, not "creating unlimited weddings." */
export const INVITE_LIMIT: Limit = { max: 5, windowMs: 60 * 60 * 1000 };

/**
 * Failed unlock attempts. Generous enough never to bite a real typo.
 *
 * Also spent by `POST /api/accounts/invite/[token]` on every accept-invite
 * attempt, success included — there, every attempt counts, not only failures.
 */
export const AUTH_LIMIT: Limit = { max: 20, windowMs: 15 * 60 * 1000 };

/** Ordinary document writes by a signed-in member. */
export const WRITE_LIMIT: Limit = { max: 600, windowMs: 60 * 1000 };

/**
 * Downloading the whole wedding. The largest single response the API serves,
 * so it gets its own ceiling rather than sharing the write budget — but
 * generous enough that a person clicking "download" a few times, or a script
 * taking periodic backups, never notices it.
 */
export const EXPORT_LIMIT: Limit = { max: 20, windowMs: 60 * 60 * 1000 };

/**
 * Publishing the guest link. It republishes itself as seats change, a few
 * seconds after the last edit, so an evening of seating is dozens — not
 * thousands.
 */
export const SHARE_LIMIT: Limit = { max: 300, windowMs: 60 * 60 * 1000 };

export function allow(key: string, limit: Limit): boolean {
  const now = Date.now();
  sweep(now);

  const found = windows.get(key);
  if (!found || found.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + limit.windowMs });
    return true;
  }

  if (found.count >= limit.max) return false;
  found.count += 1;
  return true;
}
