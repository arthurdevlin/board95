"use client";

import { useActionState } from "react";
import { saveBusScheduleAction, type BusScheduleState } from "@/lib/bus-schedule-actions";
import { BUS_WEEKDAYS } from "@/lib/bus-timetable";
import { CITIES } from "@/lib/cities";

type Schedule = { id: string; origin: string; destination: string; departureTime: string; weekdays: number[]; fareMWK: number; seatsTotal: number; pickupAvailable: boolean; pickupFeeMWK: number | null; active: boolean; departurePoint: { name: string }; vehicle: { model: string; plate: string; seats: number } };
const initialState: BusScheduleState = { status: "idle", message: "" };

export default function BusScheduleForm({ operatorId, schedule, vehicle }: { operatorId: string; schedule?: Schedule; vehicle?: { model: string; plate: string; seats: number } }) {
  const [state, action, pending] = useActionState(saveBusScheduleAction, initialState);
  return <form action={action} className="dashboard-form" aria-busy={pending}>
    <input type="hidden" name="operatorId" value={operatorId}/>
    {schedule && <input type="hidden" name="scheduleId" value={schedule.id}/>}
    <fieldset className="bus-schedule-fields dashboard-form-wide" disabled={pending}>
      {schedule ? <p className="dashboard-help dashboard-form-wide">{schedule.vehicle.model} · {schedule.vehicle.plate}</p> : <>
        <label className="field"><span>Bus model</span><input name="vehicleModel" required minLength={2} maxLength={80} placeholder="Yutong Coach" defaultValue={vehicle?.model} readOnly={Boolean(vehicle)}/></label>
        <label className="field"><span>Number plate</span><input name="plate" required minLength={3} maxLength={20} placeholder="BT 1234" defaultValue={vehicle?.plate} readOnly={Boolean(vehicle)}/></label>
      </>}
      <label className="field"><span>Seats per departure</span><input name="seats" type="number" min="1" max={schedule?.vehicle.seats ?? vehicle?.seats ?? 100} required defaultValue={schedule?.seatsTotal ?? vehicle?.seats ?? 52}/></label>
      <label className="field"><span>From</span><select name="origin" required defaultValue={schedule?.origin ?? "Blantyre"}>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></label>
      <label className="field"><span>To</span><select name="destination" required defaultValue={schedule?.destination ?? "Lilongwe"}>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></label>
      <label className="field"><span>Departure time (Malawi)</span><input name="time" type="time" required defaultValue={schedule?.departureTime}/></label>
      <fieldset className="bus-operating-days dashboard-form-wide"><legend>Operating days</legend><p className="dashboard-help">Leave all days selected for a bus that departs every day.</p><div>{BUS_WEEKDAYS.map((day, index) => <label className="pickup-check" key={day}><input name="weekdays" type="checkbox" value={index} defaultChecked={schedule ? schedule.weekdays.includes(index) : true}/><span>{day}</span></label>)}</div></fieldset>
      <label className="field"><span>Departure stage / station</span><input name="departurePoint" required minLength={2} maxLength={100} placeholder="Company station or stage" defaultValue={schedule?.departurePoint.name}/></label>
      <label className="field"><span>Fare per seat (MWK)</span><input name="fareMWK" type="number" min="1" step="1" required defaultValue={schedule?.fareMWK}/></label>
      <label className="pickup-check"><input name="pickupAvailable" type="checkbox" defaultChecked={schedule?.pickupAvailable}/><span>Offer pickup</span></label>
      <label className="field"><span>Pickup fee (MWK)</span><input name="pickupFeeMWK" type="number" min="0" step="1" defaultValue={schedule?.pickupFeeMWK ?? 0}/></label>
      <label className="pickup-check dashboard-form-wide"><input name="active" type="checkbox" defaultChecked={schedule?.active ?? true}/><span>Service is running (uncheck to pause)</span></label>
    </fieldset>
    {state.message && <p className={`alert dashboard-form-wide ${state.status === "error" ? "alert-error" : "alert-info"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving timetable…" : schedule ? "Save timetable" : "Add recurring bus"}</button>
  </form>;
}
