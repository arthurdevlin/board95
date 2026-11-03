import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createOperatorTripAction, updateBookingStatusAction } from "@/lib/actions";
import { formatMWK, formatTimestamp } from "@/lib/format";
import Link from "next/link";
import DashboardSectionNavigation from "@/components/DashboardSectionNavigation";
import { operatorWorkspace } from "@/lib/operator-workspace";

export const metadata = { title: "Operator dashboard | Board95" };
export const instant = false;

export default async function OperatorPage({ searchParams }: { searchParams: Promise<{ bookingPage?: string; pendingPage?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  const companyMemberships = session.user.role === "CUSTOMER" ? await prisma.operatorMember.findMany({ where: { userId: session.user.id, operator: { kind: "BUS_COMPANY", active: true } }, select: { operatorId: true, role: true } }) : [];
  if (session.user.role === "CUSTOMER" && companyMemberships.length === 0) {
    const application = await prisma.application.findFirst({ where: { userId: session.user.id, kind: { in: ["TAXI_OWNER", "BUS_COMPANY"] } }, orderBy: { createdAt: "desc" } });
    if (!application) redirect("/account");
    return <section className="dashboard-page">
      <div className="dashboard-intro"><p className="dashboard-eyebrow">{application.kind.replace("_", " ")} APPLICATION</p><h1 className="page-title page-title--plain">Operator dashboard</h1><p>Application status and updates are available here.</p></div>
      <div className="panel application-status-panel"><span className={`status-badge status-${application.status.toLowerCase()}`}>{application.status}</span><h2>{application.displayName}</h2><p>{application.status === "PENDING" ? "Your operator tools will unlock after admin approval. You can still use passenger features in the meantime." : application.status === "DECLINED" ? "This application was declined. Contact Board95 support or submit a new application from My account." : "Your application is approved. Refresh or sign in again to open operator tools."}</p><Link className="btn btn-secondary" href="/account">Go to My account</Link></div>
    </section>;
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role) && companyMemberships.length === 0) redirect("/account");
  const operatorWhere = session.user.role === "ADMIN" ? {} : session.user.role === "OWNER" ? { ownerId: session.user.id } : { id: { in: companyMemberships.map((membership) => membership.operatorId) } };
  const canCreateTrips = (operatorId: string) => session.user.role !== "CUSTOMER" || companyMemberships.some((membership) => membership.operatorId === operatorId && membership.role === "ADMIN");
  const operators = await prisma.operator.findMany({
    where: operatorWhere,
    select: {
      id: true,
      name: true,
      kind: true,
      verified: true,
      active: true,
      vehicles: { select: { id: true, model: true, plate: true, seats: true }, orderBy: { model: "asc" } },
      trips: {
        select: {
          id: true,
          origin: true,
          destination: true,
          departureAt: true,
          seatsAvailable: true,
          seatsTotal: true,
          fareMWK: true,
          vehicle: { select: { id: true, model: true, plate: true } },
          departurePoint: { select: { name: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { departureAt: "desc" },
        take: 40,
      },
      _count: { select: { vehicles: true, trips: true } },
    },
  });
  const tripCount = operators.reduce((count, operator) => count + operator._count.trips, 0);
  const params = await searchParams;
  const rawBookingPage = params.bookingPage ?? "0";
  const requestedBookingPage = /^\d+$/.test(rawBookingPage) ? Math.min(100_000, Number(rawBookingPage)) : 0;
  const rawPendingPage = params.pendingPage ?? "0";
  const requestedPendingPage = /^\d+$/.test(rawPendingPage) ? Math.min(100_000, Number(rawPendingPage)) : 0;
  const bookingWhere = session.user.role === "ADMIN" ? {} : session.user.role === "OWNER" ? { trip: { operator: { ownerId: session.user.id } } } : { trip: { operatorId: { in: companyMemberships.map((membership) => membership.operatorId) } } };
  const [pendingCount, resolvedCount] = await Promise.all([
    prisma.booking.count({ where: { ...bookingWhere, status: "PENDING" } }),
    prisma.booking.count({ where: { ...bookingWhere, status: { in: ["ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED"] } } }),
  ]);
  const pendingPages = Math.max(1, Math.ceil(pendingCount / 25));
  const pendingPage = Math.min(requestedPendingPage, pendingPages - 1);
  const historyPages = Math.max(1, Math.ceil(resolvedCount / 25));
  const bookingPage = Math.min(requestedBookingPage, historyPages - 1);
  const [pendingBookings, resolvedBookings] = await Promise.all([
    prisma.booking.findMany({ where: { ...bookingWhere, status: "PENDING" }, select: { id: true, guestName: true, guestPhone: true, guestEmail: true, pickupRequested: true, pickupLocation: true, totalMWK: true, userId: true, user: { select: { name: true } }, trip: { select: { origin: true, destination: true, operator: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 25, skip: pendingPage * 25 }),
    prisma.booking.findMany({ where: { ...bookingWhere, status: { in: ["ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED"] } }, select: { id: true, guestName: true, totalMWK: true, userId: true, status: true, user: { select: { name: true } }, trip: { select: { origin: true, destination: true, departureAt: true, operator: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 25, skip: bookingPage * 25 }),
  ]);
  const workspace = operatorWorkspace(operators.map((operator) => operator.kind), companyMemberships.length > 0);
  const navigationEntries = !operators.length ? [
    { label: "Overview", href: "#overview" },
  ] : [
    { label: "Overview", href: "#overview" },
    { label: `${workspace.name} workspaces`, children: operators.map((operator) => ({
      label: operator.name,
      children: [
        { label: `${operator.kind === "BUS_COMPANY" ? "Bus" : "Taxi"} summary`, href: `#operator-profile-${operator.id}` },
        { label: "Trip schedule", href: `#operator-trips-${operator.id}` },
        { label: operator.kind === "BUS_COMPANY" ? "Buses" : "Taxis", href: `#operator-vehicles-${operator.id}` },
        ...(operator.active && operator.verified && canCreateTrips(operator.id) ? [{ label: "Add a departure", href: `#operator-add-trip-${operator.id}` }] : []),
      ],
    })) },
    { label: "Bookings", children: [
      { label: "Pending requests", href: "#operator-bookings" },
      { label: "Booking history", href: "#operator-booking-history" },
    ] },
  ];
  return <section className={"dashboard-page" + (session.user.role === "CUSTOMER" ? " company-staff-dashboard" : "")}>
    <div className="dashboard-shell">
    <DashboardSectionNavigation entries={navigationEntries} label={workspace.sections}/>
    <div className="dashboard-content">
    <div className="dashboard-intro" id="overview"><p className="dashboard-eyebrow">{workspace.workspace}</p><h1 className="page-title page-title--plain">{workspace.title}</h1><p>{workspace.description}</p></div>
    {!operators.length ? <div className="panel"><h2>No operator account linked</h2><p className="field-hint">Ask the administrator to connect your operator profile.</p></div> : <>
      <div className="dashboard-stats" id="workspace-stats"><Link href={operators[0] ? `#operator-profile-${operators[0].id}` : "#workspace-stats"}><span>{workspace.profiles}</span><strong>{operators.length}</strong></Link><Link href={operators[0] ? `#operator-vehicles-${operators[0].id}` : "#workspace-stats"}><span>{workspace.vehicles}</span><strong>{operators.reduce((sum, operator) => sum + operator._count.vehicles, 0)}</strong></Link><Link href="#operator-trips"><span>{workspace.trips}</span><strong>{tripCount}</strong></Link><Link href="#operator-bookings"><span>Pending requests</span><strong>{pendingCount}</strong></Link></div>
      {operators.map((operator) => <details className="panel dashboard-panel admin-collapsible" id={`operator-profile-${operator.id}`} key={operator.id}><summary className="admin-panel-summary"><div><h2>{operator.name}</h2><p className="dashboard-help">{operator.kind === "BUS_COMPANY" ? "Bus company" : "Taxi owner"} · {operator.verified ? "Approved" : "Awaiting admin approval"} · {operator.active ? "Active" : "Blocked"}</p></div><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content"><div className="dashboard-actions operator-profile-actions"><span className={`status-badge ${operator.verified ? "status-accepted" : "status-pending"}`}>{operator.verified ? "Verified" : "Pending review"}</span>{session.user.role !== "CUSTOMER" && <Link className="btn btn-secondary" href={`/operator/profiles/${operator.id}`}>Manage profile</Link>}</div>
        {operator.id === operators[0]?.id && <span id="operator-trips"/>}<h3 className="dashboard-subheading" id={`operator-trips-${operator.id}`}>Trip schedule</h3>{operator.trips.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Route / departure</th><th>Vehicle</th><th>Seats</th><th>Bookings</th><th>Fare</th><th>Manage</th></tr></thead><tbody>{operator.trips.map((trip) => <tr key={trip.id}><td>{session.user.role === "CUSTOMER" ? <span>{trip.origin} → {trip.destination}</span> : <Link href={`/operator/trips/${trip.id}`}>{trip.origin} → {trip.destination}</Link>}<small>{formatTimestamp(trip.departureAt)} · {trip.departurePoint.name}</small></td><td>{session.user.role === "CUSTOMER" ? <span>{trip.vehicle.model}</span> : <Link href={`/operator/vehicles/${trip.vehicle.id}`}>{trip.vehicle.model}</Link>}<small>{trip.vehicle.plate}</small></td><td>{trip.seatsAvailable}/{trip.seatsTotal}</td><td>{trip._count.bookings}</td><td>{formatMWK(trip.fareMWK)}</td><td>{session.user.role === "CUSTOMER" ? "—" : <Link className="btn btn-secondary" href={`/operator/trips/${trip.id}`}>Edit</Link>}</td></tr>)}</tbody></table></div> : <p className="field-hint">No trips have been added for this operator yet.</p>}
        <h3 className="dashboard-subheading" id={`operator-vehicles-${operator.id}`}>{operator.kind === "BUS_COMPANY" ? "Buses" : "Taxis"}</h3>{operator.vehicles.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Model</th><th>Plate</th><th>Seats</th><th>Action</th></tr></thead><tbody>{operator.vehicles.map((vehicle) => <tr key={vehicle.id}><td>{session.user.role === "CUSTOMER" ? vehicle.model : <Link href={`/operator/vehicles/${vehicle.id}`}>{vehicle.model}</Link>}</td><td>{vehicle.plate}</td><td>{vehicle.seats}</td><td>{session.user.role === "CUSTOMER" ? "—" : <Link className="btn btn-secondary" href={`/operator/vehicles/${vehicle.id}`}>Manage</Link>}</td></tr>)}</tbody></table></div> : <p className="field-hint">No vehicles linked yet.</p>}
        {operator.kind === "TAXI_OWNER" && <p className="dashboard-help">Daily scheduling rule: one taxi trip per vehicle per Malawi calendar day.</p>}
        {operator.active && operator.verified && canCreateTrips(operator.id) && <div className="operator-trip-editor"><h3 className="dashboard-subheading" id={`operator-add-trip-${operator.id}`}>Add a departure</h3><p className="dashboard-help">{operator.kind === "BUS_COMPANY" ? "Schedule departures for your buses. Enter an existing number plate to reuse its model and seat capacity." : "Schedule one trip per taxi each day. Enter an existing number plate to reuse its model and seat capacity."}</p><form action={createOperatorTripAction} className="dashboard-form"><input type="hidden" name="operatorId" value={operator.id}/><label className="field"><span>Vehicle model</span><input name="vehicleModel" required minLength={2} maxLength={80} placeholder={operator.kind === "BUS_COMPANY" ? "Yutong Coach" : "Toyota Hiace"}/></label><label className="field"><span>Number plate</span><input name="plate" required minLength={3} maxLength={20} placeholder="BT 1234"/></label><label className="field"><span>Seats</span><input name="seats" type="number" min="1" max="100" required defaultValue={operator.kind === "BUS_COMPANY" ? 52 : 7}/></label><label className="field"><span>From</span><select name="origin" required defaultValue="Blantyre"><option>Blantyre</option><option>Lilongwe</option><option>Mzuzu</option></select></label><label className="field"><span>To</span><select name="destination" required defaultValue="Lilongwe"><option>Blantyre</option><option>Lilongwe</option><option>Mzuzu</option></select></label><label className="field"><span>Departure date</span><input name="date" type="date" required/></label><label className="field"><span>Departure time</span><input name="time" type="time" required/></label><label className="field"><span>{operator.kind === "BUS_COMPANY" ? "Station" : "Taxi stage"}</span><input name="departurePoint" required minLength={2} maxLength={100} placeholder="Name of departure point"/></label><label className="field"><span>Fare per seat (MWK)</span><input name="fareMWK" type="number" min="1" step="1" required/></label><label className="pickup-check"><input name="pickupAvailable" type="checkbox"/><span>Offer pickup</span></label><label className="field"><span>Pickup fee (MWK)</span><input name="pickupFeeMWK" type="number" min="0" step="1" defaultValue="0"/></label><button className="btn btn-primary" type="submit">Publish departure</button></form></div>}
      </div></details>)}
      <details className="panel dashboard-panel admin-collapsible" id="operator-bookings"><summary className="admin-panel-summary"><h2>Pending booking requests</h2><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content"><p className="dashboard-help">Passenger contact and pickup details are private to the operator assigned to the trip.</p>{!pendingBookings.length ? <p className="field-hint">No new requests.</p> : <><div className="dashboard-list">{pendingBookings.map((booking) => <article className="dashboard-list-item" key={booking.id}><div><strong>{booking.guestName ?? booking.user?.name ?? "Passenger"} · {booking.guestPhone ?? "No mobile"}</strong><span>{booking.trip.origin} → {booking.trip.destination} · {booking.trip.operator.name}</span><span>{booking.guestEmail ?? "No email"}{booking.pickupRequested ? ` · Pickup: ${booking.pickupLocation}` : " · No pickup"}</span><span>{formatMWK(booking.totalMWK)} · Ref {booking.id.slice(-8).toUpperCase()}</span></div><div className="dashboard-actions"><Link className="btn btn-secondary" href={`/bookings/${booking.id}/chat`}>Chat</Link><form action={updateBookingStatusAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="status" value="ACCEPTED"/><button className="btn btn-secondary" type="submit">Accept</button></form><form action={updateBookingStatusAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="status" value="DECLINED"/><button className="btn btn-danger" type="submit">Decline</button></form></div></article>)}</div>{pendingPages > 1 && <div className="dashboard-actions booking-pagination">{pendingPage > 0 ? <Link className="btn btn-secondary" href={`/operator?pendingPage=${pendingPage - 1}&bookingPage=${bookingPage}#operator-bookings`}>Newer</Link> : <span aria-disabled="true">Newer</span>}<span aria-current="page">Page {pendingPage + 1} of {pendingPages}</span>{pendingPage + 1 < pendingPages ? <Link className="btn btn-secondary" href={`/operator?pendingPage=${pendingPage + 1}&bookingPage=${bookingPage}#operator-bookings`}>Older</Link> : <span aria-disabled="true">Older</span>}</div>}</>}</div></details>
      <details className="panel dashboard-panel admin-collapsible" id="operator-booking-history"><summary className="admin-panel-summary"><h2>Booking history</h2><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content">{resolvedBookings.length === 0 ? <p className="field-hint">Resolved bookings will appear here.</p> : <><div className="dashboard-list">{resolvedBookings.map((booking) => <article className="dashboard-list-item" key={booking.id}><div><strong>{booking.guestName ?? booking.user?.name ?? "Passenger"}</strong><span>{booking.trip.origin} → {booking.trip.destination} · {booking.trip.operator.name}</span><span>{formatMWK(booking.totalMWK)} · Ref {booking.id.slice(-8).toUpperCase()}</span></div><div className="dashboard-actions"><span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span><Link className="btn btn-secondary" href={`/bookings/${booking.id}/chat`}>Chat</Link>{booking.status === "ACCEPTED" && booking.trip.departureAt <= new Date() && <form action={updateBookingStatusAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="status" value="COMPLETED"/><button className="btn btn-secondary" type="submit">Mark completed</button></form>}</div></article>)}</div><div className="dashboard-actions booking-pagination">{bookingPage > 0 ? <Link className="btn btn-secondary" href={`/operator?bookingPage=${bookingPage - 1}&pendingPage=${pendingPage}#operator-booking-history`}>Newer</Link> : <span aria-disabled="true">Newer</span>}<span aria-current="page">Page {bookingPage + 1} of {historyPages}</span>{bookingPage + 1 < historyPages ? <Link className="btn btn-secondary" href={`/operator?bookingPage=${bookingPage + 1}&pendingPage=${pendingPage}#operator-booking-history`}>Older</Link> : <span aria-disabled="true">Older</span>}</div></>}</div></details>
    </>}
    </div>
    </div>
  </section>;
}
