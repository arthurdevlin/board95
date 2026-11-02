import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { archiveBookingHistoryAction, cancelCarHireRequestAction, cancelPassengerBookingAction, signOutAction, submitAccountApplicationAction } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatMWK } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "My account | Board95" };

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
  const dashboardHref = session.user.role === "ADMIN" ? "/admin" : session.user.role === "OWNER" ? "/operator" : session.user.role === "CAR_HIRER" ? "/car-hire/dashboard" : null;

  return (
    <section>
      <h1 className="page-title page-title--plain">My account</h1>

      <div className="panel">
        <div className="passenger-dashboard-heading"><div><p className="dashboard-eyebrow">{session.user.role === "OWNER" ? "TAXI DRIVER ACCOUNT" : session.user.role === "CAR_HIRER" ? "CAR-HIRE ACCOUNT" : session.user.role === "ADMIN" ? "ADMINISTRATOR ACCOUNT" : "PASSENGER DASHBOARD"}</p><h2>Welcome, {session.user.name}</h2></div><span className="field-hint">{session.user.email}</span></div>
      </div>

      {carHireRequests.length > 0 && <div className="panel dashboard-panel"><h2>My car-hire requests</h2><div className="dashboard-list">{carHireRequests.map((request) => <article className="dashboard-list-item" key={request.id}><div><strong>{request.listing.name}</strong><span>{new Intl.DateTimeFormat("en-MW", { dateStyle: "medium", timeZone: "Africa/Blantyre" }).format(request.startsAt)} to {new Intl.DateTimeFormat("en-MW", { dateStyle: "medium", timeZone: "Africa/Blantyre" }).format(request.endsAt)} · {formatMWK(request.totalMWK)}</span><span>Reference: {request.id.slice(-8).toUpperCase()}</span></div><div className="dashboard-actions"><span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span>{request.reviewedByAdmin && <small className="admin-action-note">by administrator</small>}{["PENDING", "ACCEPTED"].includes(request.status) && request.startsAt > new Date() && <form action={cancelCarHireRequestAction}><input type="hidden" name="requestId" value={request.id}/><button className="btn btn-danger" type="submit">Cancel</button></form>}</div></article>)}</div></div>}

      {application === "retry" && <p className="alert alert-error" role="alert">Your account was created, but the provider application could not be completed. Review the form below and try again.</p>}

      {dashboardHref && <p className="dashboard-link-row"><Link className="btn btn-secondary" href={dashboardHref}>Open your dashboard</Link></p>}

      {session.user.role === "CUSTOMER" && !hasActiveApplication && <div className="panel dashboard-panel"><h2>Apply for an operator account</h2><p className="dashboard-help">The Board95 admin team reviews applications before publishing operator or vehicle listings.</p><form action={submitAccountApplicationAction} className="dashboard-form"><label className="field"><span>Account type</span><select name="kind" required defaultValue=""><option value="" disabled>Select an account type</option><option value="TAXI_OWNER">Taxi owner</option><option value="CAR_HIRER">Car-hire owner</option></select></label><label className="field"><span>Business / operator name</span><input name="displayName" required minLength={2} maxLength={100}/></label><label className="field"><span>Malawi mobile number</span><input name="phone" type="tel" inputMode="tel" placeholder="0991 234 567" required pattern="(?:[+]265[ ]?(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|0(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})"/></label><button className="btn btn-primary" type="submit">Send application</button></form></div>}

      {applications.length > 0 && <div className="panel dashboard-panel"><h2>Your applications</h2><div className="dashboard-list">{applications.map((application) => <article className="dashboard-list-item" key={application.id}><div><strong>{application.displayName}</strong><span>{application.kind.replace("_", " ")} · Submitted {new Intl.DateTimeFormat("en-MW", { dateStyle: "medium", timeZone: "Africa/Blantyre" }).format(application.createdAt)}</span></div><span className={`status-badge status-${application.status.toLowerCase()}`}>{application.status}</span>{application.reviewedByAdmin && <small className="admin-action-note">by administrator</small>}</article>)}</div></div>}

      <div className="panel">
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
                  <div><dt>Departure</dt><dd>{new Intl.DateTimeFormat("en-MW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Blantyre" }).format(booking.trip.departureAt)}</dd></div>
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
      </div>

      <form action={signOutAction} className="trip-cta">
        <button type="submit" className="btn btn-secondary">
          Sign out
        </button>
      </form>
    </section>
  );
}
