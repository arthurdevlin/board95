import ServiceReviews from "@/components/ServiceReviews";
import ShareListing from "@/components/ShareListing";
import { ArrowLeft, CarFront } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import RouteLoading from "@/components/RouteLoading";
import { prisma } from "@/lib/prisma";
import { formatMWK } from "@/lib/format";
import CarHireRequestForm from "@/components/CarHireRequestForm";
import { carHireDistrictName } from "@/lib/car-hire-districts";
import { getSession } from "@/lib/session";
import { canBrowseListings, roleHome } from "@/lib/access";

export const metadata = { title: "Car profile | Board95" };
const vehicleTypeLabels: Record<string, string> = { SALOON: "Saloon", SUV: "SUV", PICKUP: "Pickup", MINIBUS: "Minibus", BUS: "Bus", TRUCK: "Truck", LORRY: "Lorry", VAN: "Van", OTHER: "Other" };

export default function CarHireProfilePage({ params }: { params: Promise<{ listingId: string }> }) {
  return <Suspense fallback={<RouteLoading label="Loading vehicle" />}>
    <CarHireProfile params={params} />
  </Suspense>;
}

async function CarHireProfile({ params }: { params: Promise<{ listingId: string }> }) {
  // Expiry is evaluated for each request, never against a prerender timestamp.
  await connection();
  const session = await getSession();
  const preview = !canBrowseListings(session?.user);
  if (preview && session?.user.role !== "CAR_HIRER") redirect(roleHome(session?.user));
  const { listingId } = await params;
  const listing = await prisma.carHireListing.findFirst({
    where: { id: listingId, expiresAt: { gt: new Date() }, ...(preview ? { ownerId: session!.user.id } : { available: true }), owner: { active: true } },
    include: { owner: { select: { name: true } } },
  });
  if (!listing) notFound();

  return <section className="car-profile-page">
    <Link href="/car-hire" className="car-profile-back"><ArrowLeft size={16} aria-hidden="true"/>Back to car hire</Link>
    <article className="panel car-profile-card">
      <div className="car-profile-photo">
        {listing.photoUrl ? <Image src={listing.photoUrl} alt={`${listing.model} for hire`} fill sizes="(max-width: 760px) 100vw, 56rem" preload /> : <div className="car-photo-placeholder" role="img" aria-label="No vehicle photo has been added"><CarFront size={60} strokeWidth={1.3} aria-hidden="true"/><span>Photo coming soon</span></div>}
      </div>
      <div className="car-profile-content"><ServiceReviews kind="providerUserId" id={listing.ownerId} label="Owner"/><ServiceReviews kind="carListingId" id={listing.id} label="Vehicle"/>
        <div className="hire-card-top"><div><p className="dashboard-eyebrow">{carHireDistrictName(listing.district)} · {vehicleTypeLabels[listing.vehicleType]}{listing.vehicleType === "LORRY" && listing.lorryCapacityTons ? ` · ${listing.lorryCapacityTons} ton${listing.lorryCapacityTons === 1 ? "" : "s"}` : ""}</p><h1>{listing.name}</h1></div><span className={`status-badge ${listing.available ? "status-accepted" : "status-pending"}`}>{listing.available ? "Available" : "Unlisted"}</span></div>
        <p className="hire-model">{listing.model}</p>
        {listing.available && <ShareListing path={`/car-hire/${encodeURIComponent(listing.id)}`} title={listing.name} text={`${listing.name} · ${listing.model} for hire in ${carHireDistrictName(listing.district)} · ${formatMWK(listing.dailyRateMWK)} per day on Board95`}/>}
        <p className="car-profile-rate">{formatMWK(listing.dailyRateMWK)} <span>/ day</span></p>
        <div className="car-profile-details"><div><span>Vehicle type</span><strong>{vehicleTypeLabels[listing.vehicleType]}{listing.vehicleType === "LORRY" && listing.lorryCapacityTons ? ` · ${listing.lorryCapacityTons} tons` : ""}</strong></div><div><span>District</span><strong>{carHireDistrictName(listing.district)}, Malawi</strong></div><div><span>Listed by</span><strong>{listing.owner.name}</strong></div>{listing.contactPhone && !preview && <div><span>Contact the owner</span><strong><a href={`tel:${listing.contactPhone}`}>{listing.contactPhone}</a></strong><span className="hire-profile-contact"><a href={`https://wa.me/${listing.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a></span></div>}</div>
        <div className="car-profile-description"><h2>About this vehicle</h2><p>{listing.description || "Contact the owner for vehicle details, availability and hire arrangements."}</p></div>
        {preview ? <p className="listing-preview-note">Listing preview · Passenger rental requests are disabled.</p> : <CarHireRequestForm listingId={listing.id} dailyRateMWK={listing.dailyRateMWK}/>}
      </div>
    </article>
  </section>;
}
