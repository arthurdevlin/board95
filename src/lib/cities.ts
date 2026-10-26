export const CITIES = ["Blantyre", "Lilongwe", "Mzuzu"] as const;
export type City = (typeof CITIES)[number];
export type TransportType = "bus" | "taxi";
