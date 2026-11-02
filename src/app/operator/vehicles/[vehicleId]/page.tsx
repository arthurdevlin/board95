import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteVehicleAction, updateVehicleAction } from "@/lib/actions";

export const metadata = { title: "Manage vehicle | Board95" };
export const instant = false;

export default async function VehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  if (!["OWNER", "ADMIN"].includes(session.user.role)) redirect("/account");
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...(session.user.role === "ADMIN" ? {} : { operator: { ownerId: session.user.id } }) }, include: { operator: true, _count: { select: { trips: true } } } });
  if (!vehicle) notFound();
  return <section className="dashboard-page">
    <div className="dashboard-intro"><p className="dashboard-eyebrow">FLEET VEHICLE</p><h1 className="page-title page-title--plain">Manage {vehicle.model}</h1><p>{vehicle.operator.name} · {vehicle._count.trips} scheduled or historical trips</p></div>
    <div className="panel dashboard-panel"><h2>Vehicle details</h2><form action={updateVehicleAction} className="dashboard-form"><input type="hidden" name="vehicleId" value={vehicle.id}/><label className="field"><span>Model</span><input name="model" defaultValue={vehicle.model} required minLength={2} maxLength={80}/></label><label className="field"><span>Registration plate</span><input name="plate" defaultValue={vehicle.plate} required minLength={3} maxLength={20}/></label><label className="field"><span>Seat capacity</span><input value={vehicle.seats} disabled readOnly/><small>Capacity is fixed while the vehicle has departure records.</small></label><button className="btn btn-primary" type="submit">Save vehicle</button></form></div>
    <div className="panel dashboard-panel"><h2>Delete vehicle</h2>{vehicle._count.trips === 0 ? <form action={deleteVehicleAction}><input type="hidden" name="vehicleId" value={vehicle.id}/><button className="btn btn-danger" type="submit">Delete vehicle</button></form> : <p className="dashboard-help">This vehicle has trip history and can’t be deleted. Edit its model or plate above.</p>}</div>
    <Link className="btn btn-secondary" href="/operator">Back to operator dashboard</Link>
  </section>;
}
