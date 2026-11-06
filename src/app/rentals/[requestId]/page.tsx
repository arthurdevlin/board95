import { notFound } from "next/navigation";
import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import { rentalAccess } from "@/lib/rental-access";
import { prisma } from "@/lib/prisma";
import { formatMWK, formatShortDate } from "@/lib/format";
import { RentalMessageForm } from "@/components/RentalForms";
import { completeRentalAction } from "@/lib/rental-actions";
import ServiceReviewForm from "@/components/ServiceReviewForm";
import BookingReference from "@/components/BookingReference";

export const instant = false;
export const metadata = { title: "Your rental | Board95", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function RentalPage({ params, searchParams }: { params: Promise<{ requestId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { requestId } = await params; const query = await searchParams; const token = typeof query.token === "string" ? query.token : "";
  const access = await rentalAccess(requestId, token);
  if (!access) notFound();
  const { rental } = access;
  const messages = await prisma.rentalMessage.findMany({ where: { requestId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return <section className="dashboard-page"><PageIntro><p className="dashboard-eyebrow">YOUR RENTAL</p><h1 className="page-title page-title--plain">{rental.listing.name}</h1><p>{formatShortDate(rental.startsAt)} – {formatShortDate(rental.endsAt)} · {formatMWK(rental.totalMWK)} · {rental.status}</p></PageIntro><BookingReference reference={rental.id.slice(-8).toUpperCase()}/><Link href="/bookings/lookup">Recover a rental or booking</Link>{access.owner && rental.status === "ACCEPTED" && rental.endsAt <= new Date() && <form action={completeRentalAction}><input type="hidden" name="requestId" value={requestId}/><button className="btn btn-primary">Mark rental completed</button></form>}{access.passenger && rental.status === "COMPLETED" && !await prisma.serviceReview.findUnique({ where: { rentalRequestId: requestId } }) && <ServiceReviewForm id={requestId} kind="rental" token={token}/>}<section className="panel"><h2>Rental messages</h2><p className="dashboard-help">Private conversation between the passenger and owner. Refresh to check replies. Latest 100 messages shown.</p>{messages.reverse().map(message=><article className="rental-message" key={message.id}><strong>{message.senderId === rental.listing.ownerId ? "Owner" : message.senderId === rental.passengerId || !message.senderId ? "Passenger" : "Administrator"}</strong><p>{message.body}</p></article>)}<RentalMessageForm id={requestId} token={token}/></section></section>;
}
