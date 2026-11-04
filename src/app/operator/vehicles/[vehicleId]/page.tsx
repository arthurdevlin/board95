import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteVehicleAction, updateVehicleAction } from "@/lib/actions";
import { busManagementScope } from "@/lib/operator-management";
import BusVehicleForm, { BusServiceControl } from "@/components/BusVehicleForm";
import BusScheduleForm from "@/components/BusScheduleForm";
import { timetableDaysLabel } from "@/lib/bus-timetable";
import { formatMWK } from "@/lib/format";

export const metadata = { title: "Manage vehicle | Board95" };
export const instant = false;

export default async function VehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  const scope = session.user.role === "ADMIN" ? {} : session.user.role === "OWNER" ? { ownerId: session.user.id } : busManagementScope(session.user);
  if (!scope) redirect("/account");
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, operator: scope }, include: { operator: true, _count: { select: { trips: true, busSchedules: true } } } });
  if (!vehicle) notFound();
  if (vehicle.operator.kind === "BUS_COMPANY") {
    const schedules = await prisma.busSchedule.findMany({ where: { vehicleId }, include: { departurePoint: { select: { name: true } } }, orderBy: { departureTime: "asc" } });
    return <section className="dashboard-page">
      <div className="dashboard-intro"><p className="dashboard-eyebrow">MANAGE BUS</p><h1 className="page-title page-title--plain">{vehicle.model} · {vehicle.plate}</h1><p>{vehicle.operator.name} · {vehicle.active ? "In service" : "Removed from service"}</p></div>
      <div className="panel dashboard-panel"><h2>Bus details</h2><BusVehicleForm operatorId={vehicle.operatorId} bus={vehicle}/></div>
      <div className="panel dashboard-panel"><h2>Recurring services</h2>{schedules.length ? <div className="dashboard-list">{schedules.map((schedule) => <article className="dashboard-list-item" key={schedule.id}><div><strong>{schedule.origin} → {schedule.destination} · {schedule.departureTime}</strong><span>{timetableDaysLabel(schedule.weekdays)} · {schedule.departurePoint.name} · {formatMWK(schedule.fareMWK)}</span><span>{schedule.active ? "Running" : "Paused"}</span></div><Link className="btn btn-secondary" href={`/operator/schedules/${schedule.id}`}>Edit timetable</Link></article>)}</div> : <p className="dashboard-help">No recurring services have been added to this bus.</p>}</div>
      {vehicle.active && vehicle.operator.active && vehicle.operator.verified && <details className="panel dashboard-panel"><summary>Add a recurring service to this bus</summary><BusScheduleForm operatorId={vehicle.operatorId} vehicle={vehicle}/></details>}
      <div className="panel dashboard-panel"><h2>{vehicle.active ? "Remove bus from service" : "Restore bus"}</h2><BusServiceControl vehicleId={vehicle.id} active={vehicle.active}/></div>
      <Link className="btn btn-secondary" href="/operator">Back to bus dashboard</Link>
    </section>;
  }
  return <section className="dashboard-page">
    <div className="dashboard-intro"><p className="dashboard-eyebrow">FLEET VEHICLE</p><h1 className="page-title page-title--plain">Manage {vehicle.model}</h1><p>{vehicle.operator.name} · {vehicle._count.trips} scheduled or historical trips</p></div>
    <div className="panel dashboard-panel"><h2>Vehicle details</h2><form action={updateVehicleAction} className="dashboard-form"><input type="hidden" name="vehicleId" value={vehicle.id}/><label className="field"><span>Model</span><input name="model" defaultValue={vehicle.model} required minLength={2} maxLength={80}/></label><label className="field"><span>Registration plate</span><input name="plate" defaultValue={vehicle.plate} required minLength={3} maxLength={20}/></label><label className="field"><span>Seat capacity</span><input value={vehicle.seats} disabled readOnly/><small>Capacity is fixed while the vehicle has departure records.</small></label><button className="btn btn-primary" type="submit">Save vehicle</button></form></div>
    <div className="panel dashboard-panel"><h2>Delete vehicle</h2>{vehicle._count.trips === 0 && vehicle._count.busSchedules === 0 ? <form action={deleteVehicleAction}><input type="hidden" name="vehicleId" value={vehicle.id}/><button className="btn btn-danger" type="submit">Delete vehicle</button></form> : <p className="dashboard-help">This vehicle has trip history or a recurring timetable and can’t be deleted. Edit its model or plate above.</p>}</div>
    <Link className="btn btn-secondary" href="/operator">Back to operator dashboard</Link>
  </section>;
}
