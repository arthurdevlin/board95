type OperatorKind = "TAXI_OWNER" | "BUS_COMPANY";

export function operatorWorkspace(kinds: readonly OperatorKind[], busMember = false) {
  const uniqueKinds = new Set(kinds);
  const busOnly = (uniqueKinds.size === 1 && uniqueKinds.has("BUS_COMPANY")) || (uniqueKinds.size === 0 && busMember);
  const taxiOnly = uniqueKinds.size === 1 && uniqueKinds.has("TAXI_OWNER");
  const name = busOnly ? "Bus" : taxiOnly ? "Taxi" : "Transport";
  return {
    name,
    title: `${name} dashboard`,
    workspace: `${name} workspace`,
    sections: `${name} sections`,
    profiles: busOnly ? "Bus companies" : taxiOnly ? "Taxi profiles" : "Operator profiles",
    vehicles: busOnly ? "Buses" : taxiOnly ? "Taxis" : "Vehicles",
    trips: busOnly ? "Bus trips" : taxiOnly ? "Taxi trips" : "Trips",
    description: busOnly
      ? "Manage your buses, set recurring timetables and respond to passenger bookings."
      : taxiOnly
        ? "Manage your taxis, schedule daily trips and respond to passenger bookings."
        : "Manage your operator profiles, departures and passenger bookings.",
    busOnly,
    taxiOnly,
  };
}
