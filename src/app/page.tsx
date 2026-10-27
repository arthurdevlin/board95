import { Suspense } from "react";
import { connection } from "next/server";
import SearchForm from "@/components/SearchForm";
import TripCard from "@/components/TripCard";
import TripCardSkeleton from "@/components/TripCardSkeleton";
import { getUpcomingTrips } from "@/lib/trips";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1 className="page-title">
          Travel between Blantyre, Lilongwe and Mzuzu
        </h1>
        <p>
          Find buses and taxis, see fares and available seats, and hire a car
          when you need one.
        </p>
        <div>
          <SearchForm />
        </div>
      </section>

      <section className="section-gap">
        <h2 className="section-title">Departing soon</h2>
        <Suspense
          fallback={
            <div className="trip-grid mt-4 grid gap-4 md:grid-cols-2">
              <TripCardSkeleton />
              <TripCardSkeleton />
            </div>
          }
        >
          <DepartingSoon />
        </Suspense>
      </section>
    </>
  );
}

// This reads the database and the current time, so it renders per request.
// connection() tells Next.js "wait for a real request before running this".
async function DepartingSoon() {
  await connection();
  const soon = await getUpcomingTrips(2);
  if (soon.length === 0) {
    return <p className="empty-state mt-4">No upcoming trips yet.</p>;
  }
  return (
    <div className="trip-grid mt-4 grid gap-4 md:grid-cols-2">
      {soon.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
