/**
 * How long an account wedding nobody writes to is kept — the period the
 * Privacy Policy states. The retention sweep deletes past it.
 */
export const RETENTION_MONTHS = 24;

export function retentionCutoff(now: Date = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff.toISOString();
}
