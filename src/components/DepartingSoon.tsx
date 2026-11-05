import { Suspense } from "react";
import { connection } from "next/server";
import { getUpcomingTrips } from "@/lib/trips";
import TripCard from "@/components/TripCard";
import TripCardSkeleton from "@/components/TripCardSkeleton";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function DepartingSoon() {
  return <section className="taxi-departures-section" aria-labelledby="departing-soon-heading">
    <div className="discovery-section-heading"><div><span className="departing-live-label"><i aria-hidden="true"/>Departing soon</span><h2 id="departing-soon-heading">Taxis and lifts</h2></div><Link href="/transport?type=taxi">All rides <ArrowUpRight size={14} aria-hidden="true"/></Link></div>
    <p className="discovery-section-caption">Today · Next 8 hours · Malawi time</p>
    <Suspense fallback={<div className="trip-grid grid gap-3 md:grid-cols-2"><TripCardSkeleton/><TripCardSkeleton/></div>}>
      <DepartingSoonTrips/>
    </Suspense>
  </section>;
}

async function DepartingSoonTrips() {
  await connection();
  const trips = await getUpcomingTrips(6, new Date(), "taxi");
  if (!trips.length) return <p className="discovery-empty">No taxis or lifts leaving within the next 8 hours. <Link href="/transport?type=taxi">Browse upcoming rides</Link></p>;
  return <div className="trip-grid grid gap-3 md:grid-cols-2">{trips.map((trip) => <TripCard key={trip.id} trip={trip}/>)}</div>;
}
