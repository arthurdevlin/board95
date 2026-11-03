const amountFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Blantyre",
});
const timestampFormatter = new Intl.DateTimeFormat("en-MW", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Blantyre",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-MW", {
  dateStyle: "medium", timeZone: "Africa/Blantyre",
});

// Formats 18000 as "MWK 18,000".
export function formatMWK(amount: number): string {
  return `MWK ${amountFormatter.format(amount)}`;
}

// "2026-10-23" -> "Fri, 23 Oct"
export function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00+02:00`));
}

export function formatTimestamp(date: Date): string {
  return timestampFormatter.format(date);
}

export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date);
}
