import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteCarHireListingAction, updateCarHireListingAction } from "@/lib/actions";
import { CAR_HIRE_DISTRICTS } from "@/lib/car-hire-districts";

export const metadata = { title: "Manage vehicle listing | Board95" };
export const instant = false;

export default async function ManageCarHireListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/car-hire/dashboard");
  if (!["CAR_HIRER", "ADMIN"].includes(session.user.role)) redirect("/account");
  const { listingId } = await params;
  const listing = await prisma.carHireListing.findFirst({ where: { id: listingId, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) }, include: { _count: { select: { requests: true } } } });
  if (!listing) notFound();
  return <section className="dashboard-page">
    <div className="dashboard-intro"><p className="dashboard-eyebrow">VEHICLE LISTING</p><h1 className="page-title page-title--plain">Manage {listing.name}</h1><p>Change details or replace the customer-facing photo.</p></div>
    <div className="panel dashboard-panel"><form action={updateCarHireListingAction} className="dashboard-form"><input type="hidden" name="listingId" value={listing.id}/><label className="field"><span>Listing name</span><input name="name" defaultValue={listing.name} required minLength={2} maxLength={80}/></label><label className="field"><span>Vehicle model</span><input name="model" defaultValue={listing.model} required minLength={2} maxLength={80}/></label><label className="field"><span>Vehicle type</span><select name="vehicleType" defaultValue={listing.vehicleType} required><option value="SALOON">Saloon</option><option value="SUV">SUV</option><option value="PICKUP">Pickup</option><option value="MINIBUS">Minibus</option><option value="BUS">Bus</option><option value="TRUCK">Truck</option><option value="LORRY">Lorry</option><option value="VAN">Van</option><option value="OTHER">Other</option></select></label><label className="field"><span>Lorry capacity (tons, lorries only)</span><input name="lorryCapacityTons" type="number" min="1" max="100" step="1" defaultValue={listing.lorryCapacityTons ?? ""}/></label><label className="field"><span>Contact phone / WhatsApp</span><input name="contactPhone" type="tel" inputMode="tel" defaultValue={listing.contactPhone ?? ""} required pattern="(?:[+]265[ ]?(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|0(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})"/></label><label className="field"><span>District</span><select name="district" defaultValue={listing.district}>{CAR_HIRE_DISTRICTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Daily rate (MWK)</span><input name="dailyRateMWK" type="number" min="1" step="1" defaultValue={listing.dailyRateMWK} required/></label><label className="field dashboard-form-wide"><span>Replace photo (optional)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPEG, PNG or WebP up to 750 KB. Leave blank to keep the current photo.</small></label><label className="field dashboard-form-wide"><span>Description</span><textarea name="description" maxLength={500} rows={4} defaultValue={listing.description ?? ""}/></label><button className="btn btn-primary" type="submit">Save listing</button></form></div>
    <div className="panel dashboard-panel"><h2>Delete listing</h2>{listing._count.requests ? <p className="dashboard-help">This listing has {listing._count.requests} rental request record(s). Unlist it to preserve the history.</p> : <form action={deleteCarHireListingAction}><input type="hidden" name="listingId" value={listing.id}/><button className="btn btn-danger" type="submit">Delete listing</button></form>}</div>
    <Link className="btn btn-secondary chat-back" href="/car-hire/dashboard">Back to dashboard</Link>
  </section>;
}
