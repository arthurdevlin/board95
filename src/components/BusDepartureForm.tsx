"use client";

import { useActionState, useState } from "react";
import { saveBusDepartureAction, type BusManagementState } from "@/lib/bus-management-actions";

type Bus = { id: string; model: string; plate: string; seats: number };
type Departure = { id: string; vehicleId: string; time: string; departurePoint: string; fareMWK: number; seatsTotal: number; pickupAvailable: boolean; pickupFeeMWK: number | null; cancelled: boolean };
const initial: BusManagementState = { status: "idle", message: "" };

export default function BusDepartureForm({ trip, buses, locked, openBookings }: { trip: Departure; buses: Bus[]; locked: boolean; openBookings: number }) {
  const [state, action, pending] = useActionState(saveBusDepartureAction, initial);
  const [cancelled, setCancelled] = useState(trip.cancelled);
  const [vehicleId, setVehicleId] = useState(buses.some((bus) => bus.id === trip.vehicleId) ? trip.vehicleId : "");
  return <form action={action} className="dashboard-form" aria-busy={pending}>
    <input name="tripId" type="hidden" value={trip.id}/>
    <fieldset className="bus-schedule-fields dashboard-form-wide" disabled={locked || pending}>
      <label className="field"><span>Bus for this day</span><select name="vehicleId" value={vehicleId} required onChange={(event) => setVehicleId(event.target.value)}><option value="" disabled>Select an active bus</option>{buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.model} · {bus.plate} · {bus.seats} seats</option>)}</select></label>
      <label className="field"><span>Departure time (Malawi)</span><input name="time" type="time" defaultValue={trip.time} required/></label>
      <label className="field"><span>Departure stage / station</span><input name="departurePoint" defaultValue={trip.departurePoint} required minLength={2} maxLength={100}/></label>
      <label className="field"><span>Fare per seat (MWK)</span><input name="fareMWK" type="number" min="1" step="1" defaultValue={trip.fareMWK} required/></label>
      <label className="field"><span>Seats for this day</span><input name="seats" type="number" min="1" max={buses.find((bus) => bus.id === vehicleId)?.seats ?? 100} defaultValue={trip.seatsTotal} required/></label>
      <label className="pickup-check"><input name="pickupAvailable" type="checkbox" defaultChecked={trip.pickupAvailable}/><span>Offer pickup</span></label>
      <label className="field"><span>Pickup fee (MWK)</span><input name="pickupFeeMWK" type="number" min="0" defaultValue={trip.pickupFeeMWK ?? 0}/></label>
      <label className="pickup-check dashboard-form-wide"><input name="cancelled" type="checkbox" checked={cancelled} onChange={(event) => setCancelled(event.target.checked)}/><span>Cancel this day&apos;s departure</span></label>
      {cancelled && openBookings > 0 && <label className="pickup-check dashboard-form-wide"><input name="confirmCancellation" type="checkbox" required/><span>Cancel this departure and its {openBookings} pending or accepted bookings. Booking history will be retained.</span></label>}
    </fieldset>
    <p className="dashboard-help dashboard-form-wide">Applies to this date only. Existing booking totals stay unchanged. Passengers see updated departure details in their bookings. Restoring a cancelled day does not reopen cancelled bookings.</p>
    {state.message && <p className={`alert dashboard-form-wide ${state.status === "error" ? "alert-error" : "alert-info"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className="btn btn-primary" type="submit" disabled={locked || pending}>{pending ? "Applying changes…" : "Apply changes to this day"}</button>
  </form>;
}
