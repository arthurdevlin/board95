import { Suspense } from "react";
import { connection } from "next/server";
import { getUpcomingTrips } from "@/lib/trips";
import TripCard from "@/components/TripCard";
import TripCardSkeleton from "@/components/TripCardSkeleton";

export default function DepartingSoon() {
  return <section className="section-gap" aria-labelledby="departing-soon-heading">
    <h2 id="departing-soon-heading" className="section-title">Departing soon</h2>
    <p className="dashboard-help">Trips departing today within the next 8 hours. Times shown in Malawi time.</p>
    <Suspense fallback={<div className="trip-grid mt-4 grid gap-4 md:grid-cols-2"><TripCardSkeleton/><TripCardSkeleton/></div>}>
      <DepartingSoonTrips/>
    </Suspense>
  </section>;
}

async function DepartingSoonTrips() {
  await connection();
  const trips = await getUpcomingTrips(6);
  if (!trips.length) return <p className="empty-state mt-4">No trips departing today within the next 8 hours.</p>;
  return <div className="trip-grid mt-4 grid gap-4 md:grid-cols-2">{trips.map((trip) => <TripCard key={trip.id} trip={trip}/>)}</div>;
}
