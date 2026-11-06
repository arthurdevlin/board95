import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import TripCard from "@/components/TripCard";
import RouteLoading from "@/components/RouteLoading";
import { getPublicTrip } from "@/lib/trips";
import { getSession } from "@/lib/session";
import { canBrowseListings, roleHome } from "@/lib/access";
import { transportLocationName } from "@/lib/cities";

export const metadata = { title: "Shared trip | Board95" };

export default function SharedTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  return <Suspense fallback={<RouteLoading label="Loading trip"/>}><SharedTrip params={params}/></Suspense>;
}

async function SharedTrip({ params }: { params: Promise<{ tripId: string }> }) {
  await connection();
  const session = await getSession();
  if (!canBrowseListings(session?.user)) redirect(roleHome(session?.user));
  const { tripId } = await params;
  const trip = await getPublicTrip(tripId);
  if (!trip) notFound();

  return <section className="dashboard-page shared-trip-page">
    <Link href="/transport" className="car-profile-back">Browse all trips</Link>
    <h1 className="page-title page-title--plain">{transportLocationName(trip.origin)} to {transportLocationName(trip.destination)}</h1>
    <TripCard trip={trip}/>
  </section>;
}
