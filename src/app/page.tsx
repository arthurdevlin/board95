import { Suspense } from "react";
import { connection } from "next/server";
import SearchForm from "@/components/SearchForm";
import TripCard from "@/components/TripCard";
import { getUpcomingTrips } from "@/lib/trips";

export default function Home() {
  return (
    <>
      <section className="rounded-2xl bg-primary px-4 py-8 text-white sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">
          Travel between Blantyre, Lilongwe and Mzuzu
        </h1>
        <p className="mt-3 max-w-xl text-white/90">
          Find buses and taxis, see fares and available seats, and hire a car
          when you need one.
        </p>
        <div className="mt-6">
          <SearchForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Departing soon</h2>
        <Suspense fallback={<p className="mt-4 text-muted">Loading…</p>}>
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
    return <p className="mt-4 text-muted">No upcoming trips yet.</p>;
  }
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {soon.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
