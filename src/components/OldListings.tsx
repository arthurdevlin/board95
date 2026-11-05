
import { Download } from "lucide-react";
import PageIntro from "@/components/PageIntro";

import { transportLocationName } from "@/lib/cities";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listingHistoryScope, type ListingKind } from "@/lib/listing-history";
import { historyDateRange } from "@/lib/listing-history-format";
import { formatMWK, formatTimestamp } from "@/lib/format";
import { carHireDistrictName } from "@/lib/car-hire-districts";
import { parsePageParam, readPage, type PageParam } from "@/lib/pagination";
import ResultPagination from "@/components/ResultPagination";

export default async function OldListings({ kind, searchParams }: { kind: ListingKind; searchParams: Promise<Record<string, PageParam>> }) {
  const isTrip = kind === "trip";
  const base = isTrip ? "/operator" : "/car-hire/dashboard";
  const path = `${base}/old-listings`;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${path}`);
  const scope = await listingHistoryScope(session.user, kind);
  if (!scope) redirect("/account");
  const params = await searchParams;
  const value = (key: string) => { const raw = params[key]; return (Array.isArray(raw) ? raw[0] : raw) ?? ""; };
  const from = value("from"), to = value("to");
  let dateRange;
  try { dateRange = historyDateRange(from, to); } catch {
    return <section className="dashboard-page"><h1 className="page-title">Old listings</h1><p role="alert">Choose valid dates, with the end date on or after the start date.</p><Link href={path}>Reset dates</Link></section>;
  }
  const query = new URLSearchParams({ from, to });
  const tripWhere = { ...scope.trips, departureAt: dateRange };
  const carWhere = { ...scope.cars, expiresAt: dateRange };
  const page = parsePageParam(params.page);
  const results = isTrip
    ? await readPage(page, 25, () => prisma.tripHistory.count({ where: tripWhere }), async (skip, take) => (await prisma.tripHistory.findMany({ where: tripWhere, orderBy: [{ departureAt: "desc" }, { id: "desc" }], skip, take, include: { _count: { select: { bookings: true } } } })).map((trip) => ({ id: trip.id, title: `${transportLocationName(trip.origin)} → ${transportLocationName(trip.destination)}`, detail: `${trip.operatorName} · ${trip.vehicleModel} · ${trip.vehiclePlate} · ${trip.departurePointName}`, rate: trip.fareMWK, createdAt: trip.createdAt, date: trip.departureAt, archivedAt: trip.archivedAt, count: trip._count.bookings })))
    : await readPage(page, 25, () => prisma.carHireListingHistory.count({ where: carWhere }), async (skip, take) => (await prisma.carHireListingHistory.findMany({ where: carWhere, orderBy: [{ expiresAt: "desc" }, { id: "desc" }], skip, take, include: { _count: { select: { requests: true } } } })).map((car) => ({ id: car.id, title: car.name, detail: `${car.model} · ${carHireDistrictName(car.district)} · ${car.ownerName}`, rate: car.dailyRateMWK, createdAt: car.createdAt, date: car.expiresAt, archivedAt: car.archivedAt, count: car._count.requests })));

  return <section className="dashboard-page">
    <PageIntro className="dashboard-intro"><p className="dashboard-eyebrow">LISTING HISTORY</p><h1 className="page-title page-title--plain">Old {isTrip ? "trip" : "car-hire"} listings</h1><p>{isTrip ? "Trips move here 24 hours after departure." : "Listings move here seven days after publication or their last renewal."} Booking records remain available. All displayed dates use Malawi time.</p><Link href={base}>Back to dashboard</Link></PageIntro>
    <div className="panel dashboard-panel">
      <form action={path} className="dashboard-form" method="get"><label className="field"><span>{isTrip ? "Departure" : "Expiry"} date from</span><input type="date" name="from" defaultValue={from}/></label><label className="field"><span>To (inclusive)</span><input type="date" name="to" defaultValue={to}/></label><div className="dashboard-actions"><button className="btn btn-primary" type="submit">Filter dates</button><Link className="btn btn-secondary" href={path}>Clear</Link><a className="btn btn-secondary" href={`/api/listing-history/export?kind=${kind}&${query}`}><Download size={16} aria-hidden="true"/>Download CSV</a></div></form>
      <p className="dashboard-help">{results.total} old listing(s). CSV includes listing details and publication, departure or expiry, renewal and archive dates. CSV timestamps use UTC.</p>
      {results.rows.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Listing</th><th>{isTrip ? "Fare" : "Daily rate"}</th><th>Published</th><th>{isTrip ? "Departure" : "Expired"}</th><th>Archived</th><th>{isTrip ? "Bookings" : "Requests"}</th></tr></thead><tbody>{results.rows.map((row) => <tr key={row.id}><td>{row.title}<small>{row.detail}</small><small>Reference: {row.id}</small></td><td>{formatMWK(row.rate)}</td><td>{formatTimestamp(row.createdAt)}</td><td>{formatTimestamp(row.date)}</td><td>{formatTimestamp(row.archivedAt)}</td><td>{row.count}</td></tr>)}</tbody></table></div> : <p>No old listings match these dates.</p>}
      <ResultPagination {...results} label="Old listing pages" href={(next) => `${path}?${query}&page=${next}`}/>
    </div>
  </section>;
}
