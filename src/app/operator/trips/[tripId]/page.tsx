import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteTripScheduleAction, updateTripScheduleAction } from "@/lib/actions";
import { toMalawiDate, toMalawiTime } from "@/lib/dates";

export const metadata = { title: "Manage departure | Board95" };
export const instant = false;

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  if (!["OWNER", "ADMIN"].includes(session.user.role)) redirect("/account");
  const trip = await prisma.trip.findFirst({ where: { id: tripId, ...(session.user.role === "ADMIN" ? {} : { operator: { ownerId: session.user.id } }) }, include: { operator: true, vehicle: true, departurePoint: true, _count: { select: { bookings: true } } } });
  if (!trip) notFound();
  const locked = trip._count.bookings > 0 || trip.departureAt <= new Date();
  return <section className="dashboard-page">
    <div className="dashboard-intro"><p className="dashboard-eyebrow">SCHEDULE</p><h1 className="page-title page-title--plain">{trip.origin} to {trip.destination}</h1><p>{trip.vehicle.model} · {trip.operator.name} · {trip._count.bookings} booking records</p></div>
    <div className="panel dashboard-panel"><h2>Departure details</h2>{locked && <p className="alert alert-info">This departure has booking history or has already departed. Its schedule is locked to preserve passenger records.</p>}<form action={updateTripScheduleAction} className="dashboard-form"><input type="hidden" name="tripId" value={trip.id}/><label className="field"><span>From</span><select name="origin" defaultValue={trip.origin} disabled={locked}><option>Blantyre</option><option>Lilongwe</option><option>Mzuzu</option></select></label><label className="field"><span>To</span><select name="destination" defaultValue={trip.destination} disabled={locked}><option>Blantyre</option><option>Lilongwe</option><option>Mzuzu</option></select></label><label className="field"><span>Date</span><input name="date" type="date" defaultValue={toMalawiDate(trip.departureAt)} required disabled={locked}/></label><label className="field"><span>Departure time</span><input name="time" type="time" defaultValue={toMalawiTime(trip.departureAt)} required disabled={locked}/></label><label className="field"><span>{trip.type === "BUS" ? "Station" : "Taxi stage"}</span><input name="departurePoint" defaultValue={trip.departurePoint.name} required minLength={2} maxLength={100} disabled={locked}/></label><label className="field"><span>Fare per seat (MWK)</span><input name="fareMWK" type="number" min="1" defaultValue={trip.fareMWK} required disabled={locked}/></label><label className="pickup-check"><input name="pickupAvailable" type="checkbox" defaultChecked={trip.pickupAvailable} disabled={locked}/><span>Offer pickup</span></label><label className="field"><span>Pickup fee (MWK)</span><input name="pickupFeeMWK" type="number" min="0" defaultValue={trip.pickupFeeMWK ?? 0} disabled={locked}/></label><button className="btn btn-primary" type="submit" disabled={locked}>Save schedule</button></form></div>
    <div className="panel dashboard-panel"><h2>Delete schedule</h2>{trip._count.bookings === 0 ? <form action={deleteTripScheduleAction}><input type="hidden" name="tripId" value={trip.id}/><button className="btn btn-danger" type="submit">Delete departure</button></form> : <p className="dashboard-help">This departure has bookings and cannot be removed. Contact passengers and support to cancel safely.</p>}</div>
    <Link className="btn btn-secondary" href="/operator">Back to operator dashboard</Link>
  </section>;
}
