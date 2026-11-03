import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatMWK, formatShortDate } from "@/lib/format";
import { createCarHireListingAction, reviewCarHireRequestAction, toggleCarHireListingAction } from "@/lib/actions";
import Link from "next/link";
import DashboardSectionNavigation from "@/components/DashboardSectionNavigation";
import { CAR_HIRE_DISTRICTS, carHireDistrictName } from "@/lib/car-hire-districts";
import { parsePageParam, readPage, type PageParam } from "@/lib/pagination";
import ResultPagination from "@/components/ResultPagination";

export const metadata = { title: "Car-hire dashboard | Board95" };
export const instant = false;

type SearchParams = Promise<{ requestPage?: PageParam; listingPage?: PageParam }>;

export default async function CarHireDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/car-hire/dashboard");
  if (session.user.role === "CUSTOMER") {
    const application = await prisma.application.findFirst({ where: { userId: session.user.id, kind: "CAR_HIRER" }, orderBy: { createdAt: "desc" } });
    if (!application) redirect("/account");
    return <section className="dashboard-page">
      <div className="dashboard-intro"><p className="dashboard-eyebrow">CAR-HIRE OWNER APPLICATION</p><h1 className="page-title page-title--plain">Car-hire dashboard</h1><p>You can check your application while Board95 reviews it.</p></div>
      <div className="panel application-status-panel"><span className={`status-badge status-${application.status.toLowerCase()}`}>{application.status}</span><h2>{application.displayName}</h2><p>{application.status === "PENDING" ? "Your account is waiting for admin approval. Vehicle listings will unlock after approval." : application.status === "DECLINED" ? "This application was declined. Contact Board95 support or submit a new application from My account." : "Your application is approved. Refresh or sign in again to open the listing tools."}</p><Link className="btn btn-secondary" href="/account">Go to My account</Link></div>
    </section>;
  }
  if (session.user.role !== "CAR_HIRER") redirect("/account");

  const params = await searchParams;
  const requestsWhere = { listing: { ownerId: session.user.id } };
  const [listingResults, availableCount, requestResults] = await Promise.all([
    readPage(parsePageParam(params.listingPage), 25,
      () => prisma.carHireListing.count({ where: { ownerId: session.user.id } }),
      (skip, take) => prisma.carHireListing.findMany({ where: { ownerId: session.user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take, select: { id: true, name: true, model: true, district: true, dailyRateMWK: true, available: true } }),
    ),
    prisma.carHireListing.count({ where: { ownerId: session.user.id, available: true } }),
    readPage(parsePageParam(params.requestPage), 25,
      () => prisma.carHireRequest.count({ where: requestsWhere }),
      (skip, take) => prisma.carHireRequest.findMany({
    where: requestsWhere,
    select: { id: true, guestName: true, guestPhone: true, guestEmail: true, startsAt: true, endsAt: true, totalMWK: true, status: true, reviewedByAdmin: true, listing: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip, take,
  })),
  ]);
  const listings = listingResults.rows;
  const { rows: requests, page: requestPage, pageCount: requestPages } = requestResults;
  const navigationEntries = [
    { label: "Overview", href: "#overview" },
    { label: "Fleet", children: [
      { label: "Add a vehicle", href: "#add-vehicle" },
      { label: "Your listings", href: "#my-vehicles" },
    ] },
    { label: "Bookings", children: [
      { label: "Rental requests", href: "#rental-requests" },
    ] },
  ];

  return <section className="dashboard-page">
    <div className="dashboard-shell">
    <DashboardSectionNavigation entries={navigationEntries} label="Car-hire sections"/>
    <div className="dashboard-content">
    <div className="dashboard-intro" id="overview"><p className="dashboard-eyebrow">CAR-HIRE WORKSPACE</p><h1 className="page-title page-title--plain">Car-hire dashboard</h1><p>Manage your hire vehicles, availability and rental requests.</p></div>
    <div className="dashboard-stats"><Link href="#my-vehicles"><span>Vehicles</span><strong>{listingResults.total}</strong></Link><Link href="#my-vehicles"><span>Available</span><strong>{availableCount}</strong></Link><Link href="#my-vehicles"><span>Unavailable</span><strong>{listingResults.total - availableCount}</strong></Link></div>
    <details className="panel dashboard-panel admin-collapsible" id="add-vehicle"><summary className="admin-panel-summary"><h2>Add a vehicle</h2><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content"><p className="dashboard-help">Upload one clear vehicle photo (JPEG, PNG or WebP, up to 750 KB). Customers see it after they open the vehicle profile.</p><form action={createCarHireListingAction} className="dashboard-form"><label className="field"><span>Listing name</span><input name="name" required minLength={2} maxLength={80} placeholder="Comfortable family SUV"/></label><label className="field"><span>Vehicle model</span><input name="model" required minLength={2} maxLength={80} placeholder="Toyota Fortuner 2020"/></label><label className="field"><span>Vehicle type</span><select name="vehicleType" required defaultValue=""><option value="" disabled>Select a vehicle type</option><option value="SALOON">Saloon</option><option value="SUV">SUV</option><option value="PICKUP">Pickup</option><option value="MINIBUS">Minibus</option><option value="BUS">Bus</option><option value="TRUCK">Truck</option><option value="LORRY">Lorry</option><option value="VAN">Van</option><option value="OTHER">Other</option></select></label><label className="field"><span>Lorry capacity (tons, lorries only)</span><input name="lorryCapacityTons" type="number" min="1" max="100" step="1"/></label><label className="field"><span>District</span><select name="district" required defaultValue=""><option value="" disabled>Select a district</option>{CAR_HIRE_DISTRICTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Rate per day (MWK)</span><input name="dailyRateMWK" type="number" min="1" step="1" required/></label><label className="field"><span>Contact phone / WhatsApp</span><input name="contactPhone" type="tel" inputMode="tel" placeholder="0991 234 567" required pattern="(?:[+]265[ ]?(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|0(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})"/></label><label className="field dashboard-form-wide"><span>Vehicle photo</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required/></label><label className="field dashboard-form-wide"><span>Description</span><textarea name="description" maxLength={500} rows={3} placeholder="Transmission, seating and other useful details"/></label><button className="btn btn-primary" type="submit">Publish vehicle</button></form></div></details>
    <details className="panel dashboard-panel admin-collapsible" id="my-vehicles"><summary className="admin-panel-summary"><h2>Your listings</h2><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content">{listings.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th scope="col">Listing</th><th scope="col">District</th><th scope="col">Daily rate</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{listings.map((listing) => <tr key={listing.id}><td>{listing.name}<small>{listing.model}</small></td><td>{carHireDistrictName(listing.district)}</td><td>{formatMWK(listing.dailyRateMWK)}</td><td>{listing.available ? "Available" : "Unavailable"}</td><td><div className="dashboard-actions"><Link className="btn btn-secondary" href={`/car-hire/dashboard/${listing.id}`}>Manage</Link><form action={toggleCarHireListingAction}><input type="hidden" name="listingId" value={listing.id}/><input type="hidden" name="available" value={String(!listing.available)}/><button className={listing.available ? "btn btn-danger" : "btn btn-secondary"} type="submit">{listing.available ? "Unlist" : "List"}</button></form></div></td></tr>)}</tbody></table></div> : <p className="field-hint">No vehicles listed yet.</p>}<ResultPagination {...listingResults} label="Your vehicle listing pages" href={(page) => `/car-hire/dashboard?listingPage=${page}&requestPage=${requestPage}#my-vehicles`}/></div></details>
    <details className="panel dashboard-panel admin-collapsible" id="rental-requests"><summary className="admin-panel-summary"><h2>Rental requests</h2><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content">{requests.length ? <><div className="dashboard-list">{requests.map((request) => <article className="dashboard-list-item" key={request.id}><div><strong>{request.listing.name} · {request.guestName}</strong><span>{request.guestPhone}{request.guestEmail ? ` · ${request.guestEmail}` : ""}</span><span>{formatShortDate(request.startsAt)} to {formatShortDate(request.endsAt)} · {formatMWK(request.totalMWK)}</span></div><div className="dashboard-actions"><span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span>{request.reviewedByAdmin && <small className="admin-action-note">by administrator</small>}{request.status === "PENDING" && <><form action={reviewCarHireRequestAction}><input type="hidden" name="requestId" value={request.id}/><input type="hidden" name="decision" value="ACCEPTED"/><button className="btn btn-secondary" type="submit">Accept</button></form><form action={reviewCarHireRequestAction}><input type="hidden" name="requestId" value={request.id}/><input type="hidden" name="decision" value="DECLINED"/><button className="btn btn-danger" type="submit">Decline</button></form></>}</div></article>)}</div>{requestPages > 1 && <nav className="dashboard-actions booking-pagination" aria-label="Rental request pages">{requestPage > 1 ? <Link className="btn btn-secondary" href={`/car-hire/dashboard?requestPage=${requestPage - 1}&listingPage=${listingResults.page}#rental-requests`}>Newer</Link> : <span aria-disabled="true">Newer</span>}<span aria-current="page">Page {requestPage} of {requestPages}</span>{requestPage < requestPages ? <Link className="btn btn-secondary" href={`/car-hire/dashboard?requestPage=${requestPage + 1}&listingPage=${listingResults.page}#rental-requests`}>Older</Link> : <span aria-disabled="true">Older</span>}</nav>}</> : <p className="field-hint">New hire requests will appear here.</p>}</div></details>
    </div>
    </div>
  </section>;
}
