// Timetable calculations are separate from persistence so midnight, weekdays
// and bookings on separate service dates can be checked deterministically.
export const BUS_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DAY_MS = 86_400_000;

export function timetableDepartures(time: string, weekdays: readonly number[], firstDate: string, days: number, now: Date) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(firstDate) || !Number.isInteger(days) || days < 1 || days > 31) return [];
  const start = new Date(`${firstDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== firstDate) return [];
  const departures: { serviceDate: string; departureAt: Date }[] = [];
  for (let day = 0; day < days; day++) {
    const date = new Date(start.getTime() + day * DAY_MS);
    if (!weekdays.includes(date.getUTCDay())) continue;
    const serviceDate = date.toISOString().slice(0, 10);
    const departureAt = new Date(`${serviceDate}T${time}:00+02:00`);
    if (departureAt > now) departures.push({ serviceDate, departureAt });
  }
  return departures;
}

export function timetableDaysLabel(weekdays: readonly number[]) {
  const days = [...new Set(weekdays)].filter((day) => day >= 0 && day <= 6).sort();
  return days.length === 7 ? "Every day" : days.map((day) => BUS_WEEKDAYS[day].slice(0, 3)).join(", ");
}
