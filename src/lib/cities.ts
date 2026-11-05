// District codes match the existing database City enum. Keep Mzuzu for existing routes.
export const TRANSPORT_DISTRICTS = [
  "Balaka",
  "Blantyre",
  "Chikwawa",
  "Chiradzulu",
  "Chitipa",
  "Dedza",
  "Dowa",
  "Karonga",
  "Kasungu",
  "Likoma",
  "Lilongwe",
  "Machinga",
  "Mangochi",
  "Mchinji",
  "Mulanje",
  "Mwanza",
  "Mzimba",
  "Neno",
  "NkhataBay",
  "Nkhotakota",
  "Nsanje",
  "Ntcheu",
  "Ntchisi",
  "Phalombe",
  "Rumphi",
  "Salima",
  "Thyolo",
  "Zomba",
] as const;
export const CITIES = [...TRANSPORT_DISTRICTS, "Mzuzu"] as const;
export type City = (typeof CITIES)[number];
export type TransportType = "bus" | "taxi";

export function transportLocationName(value: string) {
  return value === "NkhataBay" ? "Nkhata Bay" : value;
}

export function parseTransportLocation(value: string): City | undefined {
  const normalized = value.trim().replace(/\s+/g, "").toLowerCase();
  return CITIES.find((location) => location.toLowerCase() === normalized);
}
