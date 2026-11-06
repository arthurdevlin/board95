"use client";
import { Plus } from "lucide-react";


import Link from "next/link";
import { useActionState, useState } from "react";
import { saveBusScheduleAction, type BusScheduleState } from "@/lib/bus-schedule-actions";
import { BUS_WEEKDAYS } from "@/lib/bus-timetable";
import { CITIES, transportLocationName } from "@/lib/cities";

type FleetBus = { id: string; model: string; plate: string; seats: number; active: boolean };
type Schedule = { id: string; origin: string; destination: string; departureTime: string; weekdays: number[]; fareMWK: number; seatsTotal: number; pickupAvailable: boolean; pickupFeeMWK: number | null; active: boolean; departurePoint: { name: string }; vehicle: FleetBus };
const initialState: BusScheduleState = { status: "idle", message: "" };

export default function BusScheduleForm({ operatorId, schedule, vehicles, vehicle }: { operatorId: string; schedule?: Schedule; vehicles: FleetBus[]; vehicle?: FleetBus }) {
  const [state, action, pending] = useActionState(saveBusScheduleAction, initialState);
  const buses = vehicles.filter((bus) => bus.active || bus.id === schedule?.vehicle.id);
  const [vehicleId, setVehicleId] = useState(schedule?.vehicle.id ?? vehicle?.id ?? "");
  const selectedBus = buses.find((bus) => bus.id === vehicleId);
  const [seats, setSeats] = useState(schedule?.seatsTotal ?? vehicle?.seats ?? 0);
  if (!buses.length) return <p className="dashboard-help">Add a bus in <Link href={`/operator#operator-vehicles-${operatorId}`}>Fleet management</Link> before creating a schedule.</p>;
  return <form action={action} className="dashboard-form" aria-busy={pending}>
    <input type="hidden" name="operatorId" value={operatorId} />
    {schedule && <input type="hidden" name="scheduleId" value={schedule.id} />}
    <fieldset className="bus-schedule-fields dashboard-form-wide" disabled={pending}>
      <label className="field"><span>Assign a saved bus</span><select name="vehicleId" required value={vehicleId} onChange={(event) => {
        setVehicleId(event.target.value);
        setSeats(buses.find((bus) => bus.id === event.target.value)?.seats ?? 0);
      }}><option value="" disabled>Choose a bus from your fleet</option>{buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.model} · {bus.plate} · {bus.seats} seats{bus.active ? "" : " · Removed from service"}</option>)}</select></label>
      {selectedBus && <p className="dashboard-help">Capacity: {selectedBus.seats} seats. <Link href={`/operator/vehicles/${selectedBus.id}`}>Manage this bus</Link>{!selectedBus.active && " — Restore this bus or choose an active bus before running the schedule."}</p>}
      <label className="field"><span>Seats per departure</span><input name="seats" type="number" min="1" max={selectedBus?.seats ?? 100} required value={seats || ""} onChange={(event) => setSeats(Number(event.target.value))} /><small>Filled from the selected bus. Reduce only if fewer seats should be offered.</small></label>
      <label className="field"><span>From district</span><select name="origin" required defaultValue={schedule?.origin ?? "Blantyre"}>{CITIES.map((city) => <option key={city} value={city}>{transportLocationName(city)}</option>)}</select></label>
      <label className="field"><span>To district</span><select name="destination" required defaultValue={schedule?.destination ?? "Lilongwe"}>{CITIES.map((city) => <option key={city} value={city}>{transportLocationName(city)}</option>)}</select></label>
      <label className="field"><span>Departure time (Malawi)</span><input name="time" type="time" required defaultValue={schedule?.departureTime} /></label>
      <fieldset className="bus-operating-days dashboard-form-wide"><legend>Operating days</legend><p className="dashboard-help">Leave all days selected for a bus that departs every day.</p><div>{BUS_WEEKDAYS.map((day, index) => <label className="pickup-check" key={day} title={day}><input name="weekdays" type="checkbox" value={index} aria-label={day} defaultChecked={schedule ? schedule.weekdays.includes(index) : true} /><span>{day.slice(0, 3)}</span></label>)}</div></fieldset>
      <label className="field"><span>Departure stage / station</span><input name="departurePoint" required minLength={2} maxLength={100} placeholder="Company station or stage" defaultValue={schedule?.departurePoint.name} /></label>
      <label className="field"><span>Fare per seat (MWK)</span><input name="fareMWK" type="number" min="1" step="1" required defaultValue={schedule?.fareMWK} /></label>
      <label className="pickup-check"><input name="pickupAvailable" type="checkbox" defaultChecked={schedule?.pickupAvailable} /><span>Offer pickup</span></label>
      <label className="field"><span>Pickup fee (MWK)</span><input name="pickupFeeMWK" type="number" min="0" step="1" defaultValue={schedule?.pickupFeeMWK ?? 0} /></label>
      <label className="pickup-check dashboard-form-wide"><input name="active" type="checkbox" defaultChecked={schedule?.active ?? true} /><span>Service is running (uncheck to pause)</span></label>
    </fieldset>
    {state.message && <p className={`alert dashboard-form-wide ${state.status === "error" ? "alert-error" : "alert-info"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className="btn btn-primary" type="submit" disabled={pending || !selectedBus}><Plus size={16} aria-hidden="true" />{pending ? "Saving timetable…" : schedule ? "Save timetable" : "Assign bus and add schedule"}</button>
  </form>;
}
