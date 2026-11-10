// Calendar days are stored as UTC-midnight dates and exchanged as YYYY-MM-DD,
// so a day never shifts when a server or browser applies its own timezone.

export function dateFromDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function dayFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar day on the server, as UTC midnight. */
export function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
