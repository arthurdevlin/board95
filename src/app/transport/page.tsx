import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import SearchForm from "@/components/SearchForm";
import TripCard from "@/components/TripCard";
import TripCardSkeleton from "@/components/TripCardSkeleton";
import { parseFilters, searchTrips } from "@/lib/trips";

export const metadata = { title: "Find transport | Board95" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The page shell is static. The part that depends on the URL's search
// parameters sits inside <Suspense>, so Next.js can send the shell instantly
// and stream the results in. (This project has cacheComponents turned on.)
export default function TransportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <section>
      <h1 className="page-title page-title--plain">Find transport</h1>
      <Suspense
        fallback={
          <div className="trip-grid mt-4 grid gap-4 md:grid-cols-2">
            <TripCardSkeleton />
            <TripCardSkeleton />
            <TripCardSkeleton />
            <TripCardSkeleton />
          </div>
        }
      >
        <Results searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  // We read the current time and the database, so wait for a real request.
  await connection();
  const filters = parseFilters(await searchParams); // searchParams is a Promise
  const results = await searchTrips(filters);
  const sameCity = filters.origin && filters.origin === filters.destination;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="search-panel">
        <SearchForm defaults={filters} />
      </div>

      <div className="results-bar">
        <p>
          {results.length} {results.length === 1 ? "trip" : "trips"} found
        </p>
        {hasFilters && (
          <Link href="/transport" className="chip-link">
            Clear filters
          </Link>
        )}
      </div>

      {sameCity && (
        <p className="notice">
          From and To are the same city. Pick two different cities.
        </p>
      )}

      {results.length === 0 ? (
        <p className="empty-state">
          No trips match your search. Try another date or clear the filters.
        </p>
      ) : (
        <div className="trip-grid mt-4 grid gap-4 md:grid-cols-2">
          {results.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </>
  );
}
