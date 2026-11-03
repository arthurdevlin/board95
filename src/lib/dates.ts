// Malawi is on Central Africa Time: UTC+2, with no daylight saving.
// We STORE times in UTC in the database and SHOW them in Malawi time.
export const TIME_ZONE = "Africa/Blantyre";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
});

// "2026-10-26" -> the start and end of that day in Malawi time.
// Returns null for things like "2026-13-45" that aren't real dates.
export function dayRange(date: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00+02:00`);
  if (Number.isNaN(start.getTime())) return null;
  // JavaScript normalizes impossible dates such as February 31; reject them.
  if (toMalawiDate(start) !== date) return null;
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

// Date -> "2026-10-26" (en-CA happens to format dates this way)
export function toMalawiDate(d: Date): string {
  return dateFormatter.format(d);
}

// Date -> "06:30" (24-hour)
export function toMalawiTime(d: Date): string {
  return timeFormatter.format(d);
}
