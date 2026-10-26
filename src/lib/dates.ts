// Malawi is on Central Africa Time: UTC+2, with no daylight saving.
// We STORE times in UTC in the database and SHOW them in Malawi time.
export const TIME_ZONE = "Africa/Blantyre";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// "2026-10-26" -> the start and end of that day in Malawi time.
// Returns null for things like "2026-13-45" that aren't real dates.
export function dayRange(date: string): { start: Date; end: Date } | null {
  const start = new Date(`${date}T00:00:00+02:00`);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

// Date -> "2026-10-26" (en-CA happens to format dates this way)
export function toMalawiDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Date -> "06:30" (24-hour)
export function toMalawiTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
