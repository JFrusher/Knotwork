/** Dates as the suite keeps them: ISO days, `2028-06-01`, in the user's own calendar. */

/** Days from `today` to an ISO date: negative once it has passed. */
export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/** The date a moment falls on where the user is, as ISO. */
export function localDay(when: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

/** Today's date where the user is, as ISO. */
export function todayIso(): string {
  return localDay(new Date());
}

/** "18 May 2028". */
export function longDate(iso: string): string {
  const when = new Date(`${iso}T12:00:00`);
  return Number.isNaN(when.getTime())
    ? iso
    : when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
