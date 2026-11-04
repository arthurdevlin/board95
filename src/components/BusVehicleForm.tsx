"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveBusVehicleAction, setBusVehicleActiveAction, type BusManagementState } from "@/lib/bus-management-actions";

const initial: BusManagementState = { status: "idle", message: "" };
export default function BusVehicleForm({ operatorId, bus }: { operatorId: string; bus?: { id: string; model: string; plate: string; seats: number } }) {
  const [state, action, pending] = useActionState(saveBusVehicleAction, initial);
  return <form action={action} className="dashboard-form" aria-busy={pending}>
    <input name="operatorId" type="hidden" value={operatorId}/>{bus && <input name="vehicleId" type="hidden" value={bus.id}/>}
    <label className="field"><span>Bus model</span><input name="model" defaultValue={bus?.model} required minLength={2} maxLength={80} disabled={pending}/></label>
    <label className="field"><span>Registration plate</span><input name="plate" defaultValue={bus?.plate} required minLength={3} maxLength={20} disabled={pending}/></label>
    <label className="field"><span>Seat capacity</span><input name="seats" type="number" min="1" max="100" defaultValue={bus?.seats ?? 52} required disabled={pending}/></label>
    {state.message && <p className={`alert dashboard-form-wide ${state.status === "error" ? "alert-error" : "alert-info"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}{!bus && state.vehicleId && <> <Link href={`/operator/vehicles/${state.vehicleId}`}>Manage bus</Link></>}</p>}
    <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving bus…" : bus ? "Save bus details" : "Add bus"}</button>
  </form>;
}

export function BusServiceControl({ vehicleId, active }: { vehicleId: string; active: boolean }) {
  const [state, action, pending] = useActionState(setBusVehicleActiveAction, initial);
  return <form action={action} aria-busy={pending}>
    <input name="vehicleId" type="hidden" value={vehicleId}/><input name="active" type="hidden" value={String(!active)}/>
    <p className="dashboard-help">{active ? "Removing a bus pauses its timetables and keeps all history. Upcoming passenger bookings must be reassigned or cancelled first." : "Restore this bus to add or enable its recurring services again."}</p>
    {state.message && <p className={`alert ${state.status === "error" ? "alert-error" : "alert-info"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className={active ? "btn btn-danger" : "btn btn-secondary"} type="submit" disabled={pending}>{pending ? "Applying…" : active ? "Remove bus from service" : "Restore bus to fleet"}</button>
  </form>;
}
