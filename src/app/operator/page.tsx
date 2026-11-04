import { withTripHistory } from "@/lib/listing-lifecycle";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createOperatorTripAction, updateBookingStatusAction } from "@/lib/actions";
import { formatMWK, formatTimestamp } from "@/lib/format";
import Link from "next/link";
import DashboardSectionNavigation from "@/components/DashboardSectionNavigation";
import { operatorWorkspace } from "@/lib/operator-workspace";
import BusScheduleForm from "@/components/BusScheduleForm";
import BusVehicleForm from "@/components/BusVehicleForm";
import { ensureBusDepartures } from "@/lib/bus-schedules";
import { timetableDaysLabel } from "@/lib/bus-timetable";
import { dayRange } from "@/lib/dates";

export const metadata = { title: "Operator dashboard | Board95" };
export const instant = false;

export default async function OperatorPage({ searchParams }: { searchParams: Promise<{ bookingPage?: string; pendingPage?: string; departureDate?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  const companyMemberships = session.user.role === "CUSTOMER" ? await prisma.operatorMember.findMany({ where: { userId: session.user.id, operator: { kind: "BUS_COMPANY" } }, select: { operatorId: true, role: true } }) : [];
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
  const params = await searchParams;
  const departureDate = typeof params.departureDate === "string" ? params.departureDate : "";
  const departureDay = departureDate ? dayRange(departureDate) : null;
  await ensureBusDepartures(departureDay ? departureDate : undefined);
  const operators = await prisma.operator.findMany({
    where: operatorWhere,
    select: {
      id: true,
      name: true,
      kind: true,
      verified: true,
      active: true,
      vehicles: { select: { id: true, model: true, plate: true, seats: true, active: true }, orderBy: { model: "asc" } },
      busSchedules: { include: { vehicle: { select: { model: true, plate: true } }, departurePoint: { select: { name: true } } }, orderBy: [{ departureTime: "asc" }, { id: "asc" }] },
      trips: {
        where: { departureAt: departureDay ? { gte: departureDay.start, lt: departureDay.end } : { gte: new Date() } },
        select: {
          id: true,
          scheduleId: true,
          scheduleOverride: true,
          cancelled: true,
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
        orderBy: { departureAt: "asc" },
        take: 40,
      },
      _count: { select: { vehicles: true, trips: true } },
    },
  });
  const tripCount = operators.reduce((count, operator) => count + operator._count.trips, 0);
  const rawBookingPage = params.bookingPage ?? "0";
  const requestedBookingPage = /^\d+$/.test(rawBookingPage) ? Math.min(100_000, Number(rawBookingPage)) : 0;
  const rawPendingPage = params.pendingPage ?? "0";
  const requestedPendingPage = /^\d+$/.test(rawPendingPage) ? Math.min(100_000, Number(rawPendingPage)) : 0;
  const bookingOperatorWhere = session.user.role === "OWNER" ? { ownerId: session.user.id } : { id: { in: companyMemberships.map((membership) => membership.operatorId) } };
  const bookingWhere = session.user.role === "ADMIN" ? {} : { OR: [{ trip: { operator: bookingOperatorWhere } }, { tripHistory: { operator: bookingOperatorWhere } }] };
  const [pendingCount, resolvedCount] = await Promise.all([
    prisma.booking.count({ where: { ...bookingWhere, status: "PENDING" } }),
    prisma.booking.count({ where: { ...bookingWhere, status: { in: ["ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED"] } } }),
  ]);
  const pendingPages = Math.max(1, Math.ceil(pendingCount / 25));
  const pendingPage = Math.min(requestedPendingPage, pendingPages - 1);
  const historyPages = Math.max(1, Math.ceil(resolvedCount / 25));
  const bookingPage = Math.min(requestedBookingPage, historyPages - 1);
  const [pendingRows, resolvedRows] = await Promise.all([
    prisma.booking.findMany({ where: { ...bookingWhere, status: "PENDING" }, select: { id: true, guestName: true, guestPhone: true, guestEmail: true, pickupRequested: true, pickupLocation: true, totalMWK: true, userId: true, user: { select: { name: true } }, trip: { select: { origin: true, destination: true, departureAt: true, operator: { select: { name: true } } } }, tripHistory: { select: { origin: true, destination: true, departureAt: true, operator: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 25, skip: pendingPage * 25 }),
    prisma.booking.findMany({ where: { ...bookingWhere, status: { in: ["ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED"] } }, select: { id: true, guestName: true, totalMWK: true, userId: true, status: true, user: { select: { name: true } }, trip: { select: { origin: true, destination: true, departureAt: true, operator: { select: { name: true } } } }, tripHistory: { select: { origin: true, destination: true, departureAt: true, operator: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 25, skip: bookingPage * 25 }),
  ]);
  const pendingBookings = pendingRows.map(withTripHistory);
  const resolvedBookings = resolvedRows.map(withTripHistory);
  const workspace = operatorWorkspace(operators.map((operator) => operator.kind), companyMemberships.length > 0);
  const navigationEntries = !operators.length ? [
    { label: "Overview", href: "#overview" },
    { label: "Old listings / CSV", href: "/operator/old-listings" },
  ] : [
    { label: "Overview", href: "#overview" },
    { label: "Old listings / CSV", href: "/operator/old-listings" },
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
    <div className="dashboard-intro" id="overview"><p className="dashboard-eyebrow">{workspace.workspace}</p><h1 className="page-title page-title--plain">{workspace.title}</h1><p>{workspace.description}</p><div className="dashboard-actions"><Link className="btn btn-secondary" href="/transport">Preview your listings</Link><Link className="btn btn-secondary" href="/operator/old-listings">Old listings / Download CSV</Link></div><p className="dashboard-help">Trips move to Old listings 24 hours after departure. Booking history and chats stay available.</p></div>
    {!operators.length ? <div className="panel"><h2>No operator account linked</h2><p className="field-hint">Ask the administrator to connect your operator profile.</p></div> : <>
      <div className="dashboard-stats" id="workspace-stats"><Link href={operators[0] ? `#operator-profile-${operators[0].id}` : "#workspace-stats"}><span>{workspace.profiles}</span><strong>{operators.length}</strong></Link><Link href={operators[0] ? `#operator-vehicles-${operators[0].id}` : "#workspace-stats"}><span>{workspace.vehicles}</span><strong>{operators.reduce((sum, operator) => sum + operator._count.vehicles, 0)}</strong></Link><Link href="#operator-trips"><span>{workspace.trips}</span><strong>{tripCount}</strong></Link><Link href="#operator-bookings"><span>Pending requests</span><strong>{pendingCount}</strong></Link></div>
      {operators.map((operator) => <details className="panel dashboard-panel admin-collapsible" id={`operator-profile-${operator.id}`} key={operator.id}><summary className="admin-panel-summary"><div><h2>{operator.name}</h2><p className="dashboard-help">{operator.kind === "BUS_COMPANY" ? "Bus company" : "Taxi owner"} · {operator.verified ? "Approved" : "Awaiting admin approval"} · {operator.active ? "Active" : "Blocked"}</p></div><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content"><div className="dashboard-actions operator-profile-actions"><span className={`status-badge ${operator.verified ? "status-accepted" : "status-pending"}`}>{operator.verified ? "Verified" : "Pending review"}</span>{session.user.role !== "CUSTOMER" && <Link className="btn btn-secondary" href={`/operator/profiles/${operator.id}`}>Manage profile</Link>}</div>
        {operator.kind === "BUS_COMPANY" && <div className="bus-timetable-list"><h3 className="dashboard-subheading">Recurring bus timetable</h3><p className="dashboard-help">Buses are added once and depart on the selected days. Each departure has its own seat availability.</p>{operator.busSchedules.length ? <div className="dashboard-list">{operator.busSchedules.map((schedule) => <article className="dashboard-list-item" key={schedule.id}><div><strong>{schedule.origin} → {schedule.destination} · {schedule.departureTime}</strong><span>{timetableDaysLabel(schedule.weekdays)} · {schedule.departurePoint.name}</span><span>{schedule.vehicle.model} · {schedule.vehicle.plate} · {formatMWK(schedule.fareMWK)} per seat</span></div><div className="dashboard-actions"><span className={`status-badge ${schedule.active ? "status-accepted" : "status-pending"}`}>{schedule.active ? "Running" : "Paused"}</span>{canCreateTrips(operator.id) && <Link className="btn btn-secondary" href={`/operator/schedules/${schedule.id}`}>Edit timetable / fare</Link>}</div></article>)}</div> : <p className="field-hint">No recurring buses yet. A company administrator can add the daily services below.</p>}</div>}
        {operator.id === operators[0]?.id && <span id="operator-trips"/>}<h3 className="dashboard-subheading" id={`operator-trips-${operator.id}`}>Departure timetable</h3><form action={`/operator#operator-trips-${operator.id}`} method="get" className="dashboard-form"><label className="field"><span>Departure day</span><input name="departureDate" type="date" defaultValue={departureDay ? departureDate : ""} required/></label><button className="btn btn-secondary" type="submit">Show this day</button>{departureDate && <Link className="btn btn-secondary" href={`/operator#operator-trips-${operator.id}`}>All upcoming days</Link>}</form>{departureDate && !departureDay && <p className="notice" role="alert">Choose a valid departure date.</p>}{operator.trips.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Route / departure</th><th>Vehicle</th><th>Seats</th><th>Bookings</th><th>Fare</th><th>Status</th><th>Action</th></tr></thead><tbody>{operator.trips.map((trip) => <tr key={trip.id}>
          <td>{canCreateTrips(operator.id) ? <Link href={`/operator/trips/${trip.id}`}>{trip.origin} → {trip.destination}<small>{formatTimestamp(trip.departureAt)}</small></Link> : <span>{trip.origin} → {trip.destination}<small>{formatTimestamp(trip.departureAt)}</small></span>}<small>{trip.departurePoint.name}</small></td>
          <td>{trip.vehicle.model}<small>{trip.vehicle.plate}</small></td><td>{trip.seatsAvailable}/{trip.seatsTotal}</td><td>{trip._count.bookings}</td><td>{formatMWK(trip.fareMWK)}</td><td>{trip.cancelled ? "Cancelled" : trip.scheduleOverride ? "Changed for this day" : "Scheduled"}</td>
          <td>{canCreateTrips(operator.id) ? <Link className="btn btn-secondary" href={`/operator/trips/${trip.id}`}>{operator.kind === "BUS_COMPANY" ? "Manage this day" : "Edit departure"}</Link> : "—"}</td>
        </tr>)}</tbody></table></div> : <p className="field-hint">No upcoming departures.</p>}

        <h3 className="dashboard-subheading" id={`operator-vehicles-${operator.id}`}>{operator.kind === "BUS_COMPANY" ? "Buses" : "Taxis"}</h3>
        {operator.kind === "BUS_COMPANY" && canCreateTrips(operator.id) && <details className="panel dashboard-panel"><summary>Add a bus to the fleet</summary><BusVehicleForm operatorId={operator.id}/></details>}
        {operator.vehicles.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Model</th><th>Plate</th><th>Seats</th><th>Status</th><th>Action</th></tr></thead><tbody>{operator.vehicles.map((vehicle) => <tr key={vehicle.id}><td>{vehicle.model}</td><td>{vehicle.plate}</td><td>{vehicle.seats}</td><td>{vehicle.active ? "In service" : "Removed"}</td><td>{canCreateTrips(operator.id) ? <Link className="btn btn-secondary" href={`/operator/vehicles/${vehicle.id}`}>{operator.kind === "BUS_COMPANY" ? "Manage bus" : "Manage"}</Link> : "—"}</td></tr>)}</tbody></table></div> : <p className="field-hint">No vehicles linked yet.</p>}

        {operator.kind === "TAXI_OWNER" && <p className="dashboard-help">Daily scheduling rule: one taxi trip per vehicle per Malawi calendar day.</p>}
        {operator.active && operator.verified && canCreateTrips(operator.id) && <div className="operator-trip-editor"><h3 className="dashboard-subheading" id={`operator-add-trip-${operator.id}`}>{operator.kind === "BUS_COMPANY" ? "Add a recurring bus" : "Add a departure"}</h3><p className="dashboard-help">{operator.kind === "BUS_COMPANY" ? "Set the bus, operating days, time, stage and fare once. Its departures will appear automatically." : "Schedule one trip per taxi each day. Enter an existing number plate to reuse its model and seat capacity."}</p>{operator.kind === "BUS_COMPANY" ? <BusScheduleForm operatorId={operator.id}/> : <form action={createOperatorTripAction} className="dashboard-form"><input type="hidden" name="operatorId" value={operator.id}/><label className="field"><span>Vehicle model</span><input name="vehicleModel" required minLength={2} maxLength={80} placeholder="Toyota Hiace"/></label><label className="field"><span>Number plate</span><input name="plate" required minLength={3} maxLength={20} placeholder="BT 1234"/></label><label className="field"><span>Seats</span><input name="seats" type="number" min="1" max="100" required defaultValue={7}/></label><label className="field"><span>From</span><select name="origin" required defaultValue="Blantyre"><option>Blantyre</option><option>Lilongwe</option><option>Mzuzu</option></select></label><label className="field"><span>To</span><select name="destination" required defaultValue="Lilongwe"><option>Blantyre</option><option>Lilongwe</option><option>Mzuzu</option></select></label><label className="field"><span>Departure date</span><input name="date" type="date" required/></label><label className="field"><span>Departure time</span><input name="time" type="time" required/></label><label className="field"><span>Taxi stage</span><input name="departurePoint" required minLength={2} maxLength={100} placeholder="Name of departure point"/></label><label className="field"><span>Fare per seat (MWK)</span><input name="fareMWK" type="number" min="1" step="1" required/></label><label className="pickup-check"><input name="pickupAvailable" type="checkbox"/><span>Offer pickup</span></label><label className="field"><span>Pickup fee (MWK)</span><input name="pickupFeeMWK" type="number" min="0" step="1" defaultValue="0"/></label><button className="btn btn-primary" type="submit">Publish departure</button></form>}</div>}
      </div></details>)}
      <details className="panel dashboard-panel admin-collapsible" id="operator-bookings"><summary className="admin-panel-summary"><h2>Pending booking requests</h2><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content"><p className="dashboard-help">Passenger contact and pickup details are private to the operator assigned to the trip.</p>{!pendingBookings.length ? <p className="field-hint">No new requests.</p> : <><div className="dashboard-list">{pendingBookings.map((booking) => <article className="dashboard-list-item" key={booking.id}><div><strong>{booking.guestName ?? booking.user?.name ?? "Passenger"} · {booking.guestPhone ?? "No mobile"}</strong><span>{booking.trip.origin} → {booking.trip.destination} · {booking.trip.operator.name}</span><span>{booking.guestEmail ?? "No email"}{booking.pickupRequested ? ` · Pickup: ${booking.pickupLocation}` : " · No pickup"}</span><span>{formatMWK(booking.totalMWK)} · Ref {booking.id.slice(-8).toUpperCase()}</span></div><div className="dashboard-actions"><Link className="btn btn-secondary" href={`/bookings/${booking.id}/chat`}>Chat</Link>{booking.trip.departureAt > new Date() && <form action={updateBookingStatusAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="status" value="ACCEPTED"/><button className="btn btn-secondary" type="submit">Accept</button></form>}<form action={updateBookingStatusAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="status" value="DECLINED"/><button className="btn btn-danger" type="submit">Decline</button></form></div></article>)}</div>{pendingPages > 1 && <div className="dashboard-actions booking-pagination">{pendingPage > 0 ? <Link className="btn btn-secondary" href={`/operator?pendingPage=${pendingPage - 1}&bookingPage=${bookingPage}#operator-bookings`}>Newer</Link> : <span aria-disabled="true">Newer</span>}<span aria-current="page">Page {pendingPage + 1} of {pendingPages}</span>{pendingPage + 1 < pendingPages ? <Link className="btn btn-secondary" href={`/operator?pendingPage=${pendingPage + 1}&bookingPage=${bookingPage}#operator-bookings`}>Older</Link> : <span aria-disabled="true">Older</span>}</div>}</>}</div></details>
      <details className="panel dashboard-panel admin-collapsible" id="operator-booking-history"><summary className="admin-panel-summary"><h2>Booking history</h2><span className="admin-collapse-icon" aria-hidden="true"/></summary><div className="admin-panel-content">{resolvedBookings.length === 0 ? <p className="field-hint">Resolved bookings will appear here.</p> : <><div className="dashboard-list">{resolvedBookings.map((booking) => <article className="dashboard-list-item" key={booking.id}><div><strong>{booking.guestName ?? booking.user?.name ?? "Passenger"}</strong><span>{booking.trip.origin} → {booking.trip.destination} · {booking.trip.operator.name}</span><span>{formatMWK(booking.totalMWK)} · Ref {booking.id.slice(-8).toUpperCase()}</span></div><div className="dashboard-actions"><span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span><Link className="btn btn-secondary" href={`/bookings/${booking.id}/chat`}>Chat</Link>{booking.status === "ACCEPTED" && booking.trip.departureAt <= new Date() && <form action={updateBookingStatusAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="status" value="COMPLETED"/><button className="btn btn-secondary" type="submit">Mark completed</button></form>}</div></article>)}</div><div className="dashboard-actions booking-pagination">{bookingPage > 0 ? <Link className="btn btn-secondary" href={`/operator?bookingPage=${bookingPage - 1}&pendingPage=${pendingPage}#operator-booking-history`}>Newer</Link> : <span aria-disabled="true">Newer</span>}<span aria-current="page">Page {bookingPage + 1} of {historyPages}</span>{bookingPage + 1 < historyPages ? <Link className="btn btn-secondary" href={`/operator?bookingPage=${bookingPage + 1}&pendingPage=${pendingPage}#operator-booking-history`}>Older</Link> : <span aria-disabled="true">Older</span>}</div></>}</div></details>
    </>}
    </div>
    </div>
  </section>;
}
