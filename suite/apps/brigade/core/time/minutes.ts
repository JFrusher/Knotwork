/**
 * Time in Cadence is an integer count of wall-clock minutes from the day's
 * 00:00. Values at or above 1440 belong to the following morning — a reception
 * ending at 01:30 is 1530. There is no Date, no timezone and no DST here.
 */

const MIN_PER_HOUR = 60;
const MIN_PER_DAY = 24 * MIN_PER_HOUR;

interface FormatClockOptions {
  /** Show the ` +1` day suffix past midnight. Default true. */
  dayOffset?: boolean;
}

/** `14:30`, or `01:30 +1` for the morning after. */
export function formatClock(min: number, options: FormatClockOptions = {}): string {
  const showOffset = options.dayOffset ?? true;
  const days = Math.floor(min / MIN_PER_DAY);
  const withinDay = ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const hours = Math.floor(withinDay / MIN_PER_HOUR);
  const mins = withinDay % MIN_PER_HOUR;
  const clock = `${pad(hours)}:${pad(mins)}`;
  return showOffset && days !== 0 ? `${clock} ${days > 0 ? "+" : "-"}${Math.abs(days)}` : clock;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
