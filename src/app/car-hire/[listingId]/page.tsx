import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import RouteLoading from "@/components/RouteLoading";
import { prisma } from "@/lib/prisma";
import { formatMWK } from "@/lib/format";
import CarHireRequestForm from "@/components/CarHireRequestForm";
import { carHireDistrictName } from "@/lib/car-hire-districts";

export const metadata = { title: "Car profile | Board95" };
const vehicleTypeLabels: Record<string, string> = { SALOON: "Saloon", SUV: "SUV", PICKUP: "Pickup", MINIBUS: "Minibus", BUS: "Bus", TRUCK: "Truck", LORRY: "Lorry", VAN: "Van", OTHER: "Other" };

export default function CarHireProfilePage({ params }: { params: Promise<{ listingId: string }> }) {
  return <Suspense fallback={<RouteLoading label="Loading vehicle" />}>
    <CarHireProfile params={params} />
  </Suspense>;
}

async function CarHireProfile({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const listing = await prisma.carHireListing.findFirst({
    where: { id: listingId, available: true, owner: { active: true } },
    include: { owner: { select: { name: true } } },
  });
  if (!listing) notFound();

  return <section className="car-profile-page">
    <Link href="/car-hire" className="car-profile-back">← Back to car hire</Link>
    <article className="panel car-profile-card">
      <div className="car-profile-photo">
        {listing.photoUrl ? <Image src={listing.photoUrl} alt={`${listing.model} for hire`} fill sizes="(max-width: 760px) 100vw, 56rem" preload /> : <div className="car-photo-placeholder" role="img" aria-label="No vehicle photo has been added"><svg aria-hidden="true" viewBox="0 0 72 48" fill="none"><path d="m12 30 5-13c1-3 3-5 7-5h24c3 0 5 2 7 5l5 13v9h-6a6 6 0 0 1-12 0H30a6 6 0 0 1-12 0h-6v-9Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="M20 26h32M24 12l4 14m20-14-4 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg><span>Photo coming soon</span></div>}
      </div>
      <div className="car-profile-content">
        <div className="hire-card-top"><div><p className="dashboard-eyebrow">{carHireDistrictName(listing.district)} · {vehicleTypeLabels[listing.vehicleType]}{listing.vehicleType === "LORRY" && listing.lorryCapacityTons ? ` · ${listing.lorryCapacityTons} ton${listing.lorryCapacityTons === 1 ? "" : "s"}` : ""}</p><h1>{listing.name}</h1></div><span className="status-badge status-accepted">Available</span></div>
        <p className="hire-model">{listing.model}</p>
        <p className="car-profile-rate">{formatMWK(listing.dailyRateMWK)} <span>/ day</span></p>
        <div className="car-profile-details"><div><span>Vehicle type</span><strong>{vehicleTypeLabels[listing.vehicleType]}{listing.vehicleType === "LORRY" && listing.lorryCapacityTons ? ` · ${listing.lorryCapacityTons} tons` : ""}</strong></div><div><span>District</span><strong>{carHireDistrictName(listing.district)}, Malawi</strong></div><div><span>Listed by</span><strong>{listing.owner.name}</strong></div>{listing.contactPhone && <div><span>Contact the owner</span><strong><a href={`tel:${listing.contactPhone}`}>{listing.contactPhone}</a></strong><span className="hire-profile-contact"><a href={`https://wa.me/${listing.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a></span></div>}</div>
        <div className="car-profile-description"><h2>About this vehicle</h2><p>{listing.description || "Contact the owner for vehicle details, availability and hire arrangements."}</p></div>
        <CarHireRequestForm listingId={listing.id} dailyRateMWK={listing.dailyRateMWK}/>
      </div>
    </article>
  </section>;
}
