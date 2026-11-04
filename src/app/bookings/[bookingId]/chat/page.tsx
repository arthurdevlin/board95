import { withTripHistory } from "@/lib/listing-lifecycle";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendBookingMessageAction } from "@/lib/actions";
import { matchesGuestToken } from "@/lib/guest-access";
import { formatMWK, formatTimestamp } from "@/lib/format";
import RouteLoading from "@/components/RouteLoading";
import SendBookingMessageButton from "@/components/SendBookingMessageButton";

export const metadata: Metadata = { title: "Booking chat | Board95", referrer: "no-referrer", robots: { index: false, follow: false } };

type ChatSearchParams = Promise<{ token?: string | string[]; notice?: string | string[] }>;

export default function BookingChatPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: ChatSearchParams }) {
  return <Suspense fallback={<RouteLoading label="Loading booking chat" auth />}>
    <BookingChatContent params={params} searchParams={searchParams} />
  </Suspense>;
}

async function BookingChatContent({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: ChatSearchParams }) {
  const [{ bookingId }, query] = await Promise.all([params, searchParams]);
  const token = Array.isArray(query.token) ? query.token[0] ?? "" : query.token ?? "";
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const session = await getSession();
  if (!session && !token) redirect("/bookings/lookup");

  const bookingRow = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      guestName: true,
      guestAccessTokenHash: true,
      guestAccessTokenExpiresAt: true,
      status: true,
      seats: true,
      totalMWK: true,
      pickupRequested: true,
      pickupLocation: true,
      trip: {
        select: {
          origin: true,
          destination: true,
          departureAt: true,
          operatorId: true,
          operator: { select: { ownerId: true, owner: { select: { name: true } } } },
          departurePoint: { select: { name: true } },
          vehicle: { select: { model: true, plate: true } },
        },
      }, tripHistory: {
        select: {
          origin: true,
          destination: true,
          departureAt: true,
          operatorId: true,
          operator: { select: { ownerId: true, owner: { select: { name: true } } } },
          departurePoint: { select: { name: true } },
          vehicle: { select: { model: true, plate: true } },
        },
      },
    },
  });
  if (!bookingRow) redirect(session ? "/account" : "/bookings/lookup");

  const booking = withTripHistory(bookingRow);
  const guestView = Boolean(
    booking.userId === null &&
    booking.guestAccessTokenExpiresAt &&
    booking.guestAccessTokenExpiresAt > new Date() &&
    matchesGuestToken(token, booking.guestAccessTokenHash),
  );
  const isPassenger = Boolean(session?.user?.id && booking.userId === session.user.id);
  const companyMember = session?.user?.id
    ? await prisma.operatorMember.findUnique({
        where: { operatorId_userId: { operatorId: booking.trip.operatorId, userId: session.user.id } },
        select: { id: true },
      })
    : null;
  const isOperator = Boolean(
    session?.user?.id &&
    ((booking.trip.operator.ownerId === session.user.id && session.user.role === "OWNER") || companyMember),
  );
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isPassenger && !isOperator && !isAdmin && !guestView) redirect(session ? "/account" : "/bookings/lookup");

  // Load the newest messages first so active conversations remain visible, then restore chronological display order.
  const messages = await prisma.bookingMessage.findMany({
    where: { bookingId },
    select: { id: true, senderId: true, guestSenderName: true, body: true, createdAt: true, sender: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  messages.reverse();
  const conversationPartner = guestView || isPassenger
    ? booking.trip.operator.owner?.name ?? "the operator"
    : booking.guestName ?? "the passenger";

  return <section className="chat-page">
    <div className="dashboard-intro"><p className="dashboard-eyebrow">BOOKING MESSAGES</p><h1 className="page-title page-title--plain">{booking.trip.origin} to {booking.trip.destination}</h1><p>Chat with {conversationPartner} about booking {booking.id.slice(-8).toUpperCase()}.</p><p className="dashboard-help">Messages are saved here and email notifications are sent. Refresh to check for replies.</p></div>
    <div className="panel ticket-summary"><div className="ticket-summary-heading"><div><p className="dashboard-eyebrow">YOUR BOOKING TICKET</p><h2>{booking.trip.origin} → {booking.trip.destination}</h2></div><span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span></div><dl className="ticket-summary-details"><div><dt>Reference</dt><dd>{booking.id.slice(-8).toUpperCase()}</dd></div><div><dt>Departure</dt><dd>{formatTimestamp(booking.trip.departureAt)}</dd></div><div><dt>Leaving from</dt><dd>{booking.trip.departurePoint.name}</dd></div><div><dt>Vehicle</dt><dd>{booking.trip.vehicle.model} · {booking.trip.vehicle.plate}</dd></div><div><dt>Seat(s)</dt><dd>{booking.seats}</dd></div><div><dt>Total</dt><dd>{formatMWK(booking.totalMWK)}</dd></div>{booking.pickupRequested && <div><dt>Pickup requested</dt><dd>{booking.pickupLocation ?? "Yes"}</dd></div>}</dl></div>
    <section className="chat-window" aria-label="Booking conversation">
      {notice === "rate-limit" && <p className="alert alert-error" role="alert">You’ve sent several messages recently. Wait a few minutes, then try again.</p>}
      {messages.length === 0 ? <div className="chat-empty"><span className="chat-avatar" aria-hidden="true">B95</span><div><strong>Board95 booking chat</strong><p>Ask about pickup, departure or your booking to start the conversation.</p></div></div> : <div className="chat-messages" aria-label="Messages">{messages.map((message) => { const mine = guestView ? message.senderId === null : message.senderId === session?.user.id; return <article className={`chat-message ${mine ? "is-mine" : "is-theirs"}`} key={message.id}><p className="chat-sender">{mine ? "You" : message.sender?.name ?? message.guestSenderName ?? "Passenger"}</p><p className="chat-bubble">{message.body}</p><time dateTime={message.createdAt.toISOString()}>{formatTimestamp(message.createdAt)}</time></article>; })}</div>}
      <form action={sendBookingMessageAction} className="chat-compose"><input type="hidden" name="bookingId" value={booking.id}/>{guestView && <input type="hidden" name="guestToken" value={token}/>}<label className="sr-only" htmlFor="booking-message">Write a message</label><textarea id="booking-message" name="body" required maxLength={1000} rows={2} placeholder="Write a message…"/><SendBookingMessageButton /></form>
    </section>
    <Link className="btn btn-secondary chat-back" href={guestView ? "/" : isOperator ? "/operator" : isAdmin ? "/admin" : "/account"}>Back to dashboard</Link>
  </section>;
}
