/** Today's date as YYYY-MM-DD in the server's local time zone (the restaurant's time zone). */
export function localDateString(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** True when a YYYY-MM-DD string is a real calendar date (rejects values such as 2026-02-31). */
export function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}
