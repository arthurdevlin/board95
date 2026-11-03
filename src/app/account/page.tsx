import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { archiveBookingHistoryAction, cancelCarHireRequestAction, cancelPassengerBookingAction, submitAccountApplicationAction } from "@/lib/actions";
import { ArrowUpRight, CarFront, Plus, LayoutDashboard, CalendarDays, Search, Ticket, Settings, Users, ClipboardCheck, BusFront } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMWK, formatTimestamp, formatShortDate } from "@/lib/format";
import Link from "next/link";
import { operatorWorkspace } from "@/lib/operator-workspace";

export const metadata = { title: "Your home | Board95" };

// This page reads the signed-in user's session on every visit, so it can
// never be prerendered as static HTML. "instant = false" tells Next.js
// that's expected, instead of treating it as a mistake to flag at build time.
export const instant = false;

// proxy.ts already redirects anyone with no session cookie away from here.
// This second check reads the real session from the database, which is the
// one to trust: a stale or forged cookie fails here even if it fooled proxy.ts.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/account");
  const { application } = await searchParams;
  const [bookings, applications, carHireRequests] = await Promise.all([
    prisma.booking.findMany({ where: { userId: session.user.id, archivedAt: null }, include: { trip: { include: { operator: true, departurePoint: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.application.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.carHireRequest.findMany({ where: { passengerId: session.user.id }, include: { listing: true }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const hasActiveApplication = applications.some((item) => item.status === "PENDING" || item.status === "APPROVED");
  const role = session.user.role;
  const [memberships, operators, fleet, pendingRentals] = await Promise.all([
    role === "CUSTOMER" ? prisma.operatorMember.findMany({ where: { userId: session.user.id, operator: { kind: "BUS_COMPANY", active: true } }, select: { operatorId: true, role: true, operator: { select: { verified: true } } } }) : [],
    role === "OWNER" ? prisma.operator.findMany({ where: { ownerId: session.user.id }, select: { id: true, kind: true, active: true, verified: true } }) : [],
    role === "CAR_HIRER" ? prisma.carHireListing.count({ where: { ownerId: session.user.id } }) : 0,
    role === "CAR_HIRER" ? prisma.carHireRequest.count({ where: { listing: { ownerId: session.user.id }, status: "PENDING" } }) : 0,
  ]);
  const operatorId = operators.find((operator) => operator.active && operator.verified)?.id ?? memberships.find((member) => member.role === "ADMIN" && member.operator.verified)?.operatorId;
  const isOperator = role === "OWNER" || memberships.length > 0;
  const workspace = operatorWorkspace(operators.map((operator) => operator.kind), memberships.length > 0);
  const roleLabel = role === "CAR_HIRER" ? "Car-hire workspace" : role === "ADMIN" ? "Administrator workspace" : isOperator ? workspace.workspace : "Your travel companion";
  const introduction = role === "CAR_HIRER" ? "Give your next customer a great journey. List a vehicle, review requests and keep your fleet up to date." : role === "ADMIN" ? "Keep Board95 moving. Review requests, support your providers and manage the community." : isOperator ? workspace.description : "Where are you heading next? Find a trip, hire a car or pick up where you left off.";
  const quickActions = role === "CAR_HIRER" ? [
    { title: "Post a car for hire", description: "Add a photo, set your rate and publish.", href: "/car-hire/dashboard#add-vehicle", icon: Plus, featured: true },
    { title: "Your dashboard", description: "Manage your vehicles and availability.", href: "/car-hire/dashboard", icon: LayoutDashboard },
    { title: "Rental requests", description: pendingRentals ? `${pendingRentals} waiting for your response.` : "Review and respond to customer requests.", href: "/car-hire/dashboard#rental-requests", icon: CalendarDays },
    { title: "Browse car hire", description: "Explore vehicles on Board95.", href: "/car-hire", icon: CarFront },
  ] : role === "ADMIN" ? [
    { title: "Admin dashboard", description: "An overview of your platform.", href: "/admin", icon: LayoutDashboard, featured: true },
    { title: "Review applications", description: "Welcome new transport providers.", href: "/admin#account-applications", icon: ClipboardCheck },
    { title: "Manage accounts", description: "Help customers and your provider team.", href: "/admin#user-accounts", icon: Users },
    { title: "Review bookings", description: "Keep passenger requests moving.", href: "/admin#pending-bookings", icon: Ticket },
  ] : isOperator ? [
    { title: workspace.title, description: `Manage your ${workspace.name.toLowerCase()} workspace.`, href: "/operator", icon: LayoutDashboard, featured: true },
    ...(operatorId ? [{ title: "Post a departure", description: "Add your next trip and seat fare.", href: `/operator#operator-add-trip-${operatorId}`, icon: Plus }] : []),
    { title: "Passenger requests", description: "Review bookings and confirm seats.", href: "/operator#operator-bookings", icon: Ticket },
    { title: "Trip schedule", description: `See upcoming ${workspace.trips.toLowerCase()} and ${workspace.vehicles.toLowerCase()}.`, href: "/operator#operator-trips", icon: workspace.busOnly ? BusFront : CarFront },
  ] : [
    { title: "Find a trip", description: "Compare buses and taxis between cities.", href: "/transport", icon: Search, featured: true },
    { title: "Hire a car", description: "Find the right vehicle for your plans.", href: "/car-hire", icon: CarFront },
    { title: "My bookings", description: "Track requests and chat with providers.", href: "#my-bookings", icon: Ticket },
    { title: "Profile & settings", description: "Update your details and preferences.", href: "/settings", icon: Settings },
  ];

  return (
    <section className="account-home">
      <div className="account-welcome">
        <div><p className="dashboard-eyebrow">{roleLabel}</p><h1>Welcome back, {session.user.name.split(" ")[0]}<span className="welcome-dot">.</span></h1><p className="account-welcome-copy">{introduction}</p><Link href="/settings" className="account-profile-link"><Settings size={14} aria-hidden="true"/>Your profile & preferences<ArrowUpRight size={14} aria-hidden="true"/></Link></div>
        {role === "CAR_HIRER" && <div className="account-fleet-summary"><span className="account-summary-icon"><CarFront size={26} aria-hidden="true"/></span><div><strong>{fleet}</strong><span>{fleet === 1 ? "vehicle in your fleet" : "vehicles in your fleet"}</span></div><Link href="/car-hire/dashboard#rental-requests"><span className="request-dot"/>{pendingRentals ? `${pendingRentals} pending rental ${pendingRentals === 1 ? "request" : "requests"}` : "No requests waiting"}<ArrowUpRight size={14} aria-hidden="true"/></Link></div>}
      </div>

      <div className="account-section-heading"><h2>What would you like to do?</h2><span>Your shortcuts</span></div>
      <div className="account-quick-actions">{quickActions.map(({ title, description, href, icon: Icon, ...action }) => <Link key={title} href={href} className={`account-action${"featured" in action && action.featured ? " is-featured" : ""}`}><span className="account-action-icon"><Icon size={23} strokeWidth={1.8} aria-hidden="true"/></span><ArrowUpRight className="account-action-arrow" size={18} aria-hidden="true"/><strong>{title}</strong><span className="account-action-description">{description}</span></Link>)}</div>

      {carHireRequests.length > 0 && <div className="panel dashboard-panel"><h2>My car-hire requests</h2><div className="dashboard-list">{carHireRequests.map((request) => <article className="dashboard-list-item" key={request.id}><div><strong>{request.listing.name}</strong><span>{formatShortDate(request.startsAt)} to {formatShortDate(request.endsAt)} · {formatMWK(request.totalMWK)}</span><span>Reference: {request.id.slice(-8).toUpperCase()}</span></div><div className="dashboard-actions"><span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span>{request.reviewedByAdmin && <small className="admin-action-note">by administrator</small>}{["PENDING", "ACCEPTED"].includes(request.status) && request.startsAt > new Date() && <form action={cancelCarHireRequestAction}><input type="hidden" name="requestId" value={request.id}/><button className="btn btn-danger" type="submit">Cancel</button></form>}</div></article>)}</div></div>}

      {application === "retry" && <p className="alert alert-error" role="alert">Your account was created, but the provider application could not be completed. Review the form below and try again.</p>}


      {session.user.role === "CUSTOMER" && !hasActiveApplication && <div className="panel dashboard-panel"><h2>Apply for an operator account</h2><p className="dashboard-help">The Board95 admin team reviews applications before publishing operator or vehicle listings.</p><form action={submitAccountApplicationAction} className="dashboard-form"><label className="field"><span>Account type</span><select name="kind" required defaultValue=""><option value="" disabled>Select an account type</option><option value="TAXI_OWNER">Taxi owner</option><option value="CAR_HIRER">Car-hire owner</option></select></label><label className="field"><span>Business / operator name</span><input name="displayName" required minLength={2} maxLength={100}/></label><label className="field"><span>Malawi mobile number</span><input name="phone" type="tel" inputMode="tel" placeholder="0991 234 567" required pattern="(?:[+]265[ ]?(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|0(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})"/></label><button className="btn btn-primary" type="submit">Send application</button></form></div>}

      {applications.length > 0 && <details className="panel account-application-history" open={applications.some((item) => item.status === "PENDING")}><summary>Account applications <span>{applications.length}</span></summary><div className="dashboard-list">{applications.map((application) => <article className="dashboard-list-item" key={application.id}><div><strong>{application.displayName}</strong><span>{application.kind.replace("_", " ")} · Submitted {formatShortDate(application.createdAt)}</span></div><span className={`status-badge status-${application.status.toLowerCase()}`}>{application.status}</span>{application.reviewedByAdmin && <small className="admin-action-note">by administrator</small>}</article>)}</div></details>}

      {(role === "CUSTOMER" || bookings.length > 0) && <div className="panel">
        <div className="passenger-dashboard-heading"><div><h2 id="my-bookings">My bookings</h2><p className="dashboard-help">Check status, message your operator and keep your history tidy.</p></div>{session.user.role === "CUSTOMER" && bookings.some((booking) => ["DECLINED", "CANCELLED", "COMPLETED"].includes(booking.status)) && <form action={archiveBookingHistoryAction}><button type="submit" className="btn btn-secondary">Clear completed history</button></form>}</div>
        {bookings.length === 0 ? <p className="field-hint mt-3">Your bookings will appear here. Guest bookings made while signed in are saved automatically.</p> : (
          <div className="account-bookings">
            {bookings.map((booking) => (
              <article className="account-booking" key={booking.id}>
                <div className="booking-heading">
                  <h3>{booking.trip.origin} to {booking.trip.destination}</h3>
                  <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>{booking.reviewedByAdmin && <small className="admin-action-note">by administrator</small>}
                </div>
                <dl className="kv">
                  <div><dt>Operator</dt><dd>{booking.trip.operator.name}</dd></div>
                  <div><dt>Departure</dt><dd>{formatTimestamp(booking.trip.departureAt)}</dd></div>
                  <div><dt>Leaving from</dt><dd>{booking.trip.departurePoint.name}</dd></div>
                  <div><dt>Passenger</dt><dd>{booking.guestName ?? session.user.name} · {booking.guestPhone ?? session.user.phone ?? "No mobile saved"}</dd></div>
                  <div><dt>Pickup</dt><dd>{booking.pickupRequested ? booking.pickupLocation ?? "Requested" : "Not requested"}</dd></div>
                  <div><dt>Total</dt><dd>{formatMWK(booking.totalMWK)}</dd></div>
                </dl>
                <p className="booking-reference">Reference: <strong>{booking.id.slice(-8).toUpperCase()}</strong></p>
                <div className="dashboard-actions booking-account-actions"><Link className="btn btn-secondary booking-chat-link" href={`/bookings/${booking.id}/chat`}>Chat with provider</Link>{session.user.role === "CUSTOMER" && ["PENDING", "ACCEPTED"].includes(booking.status) && booking.trip.departureAt > new Date() && <form action={cancelPassengerBookingAction}><input type="hidden" name="bookingId" value={booking.id}/><button className="btn btn-danger" type="submit">Cancel booking</button></form>}</div>
              </article>
            ))}
          </div>
        )}
      </div>}
    </section>
  );
}
