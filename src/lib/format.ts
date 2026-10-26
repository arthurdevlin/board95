// Formats 18000 as "MWK 18,000".
export function formatMWK(amount: number): string {
  return `MWK ${amount.toLocaleString("en-US")}`;
}

// "2026-10-23" -> "Fri, 23 Oct"
export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
