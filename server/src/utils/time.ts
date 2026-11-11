const IST_OFFSET_MS = 330 * 60 * 1000;

/** YYYY-MM-DD for the given instant, in India Standard Time. */
export function istDate(ms: number = Date.now()): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO string with +05:30 offset for a date + minutes-after-midnight IST (may roll over). */
export function istIso(date: string, minutesAfterMidnight: number): string {
  const utcMs = Date.parse(`${date}T00:00:00Z`) + minutesAfterMidnight * 60_000;
  const local = new Date(utcMs).toISOString().slice(0, 19);
  return `${local}+05:30`;
}
