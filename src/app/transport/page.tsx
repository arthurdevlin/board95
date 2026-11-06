
import { ArrowLeft, ArrowRight } from "lucide-react";
import PageIntro from "@/components/PageIntro";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import SearchForm from "@/components/SearchForm";
import TripCard from "@/components/TripCard";
import TripCardSkeleton from "@/components/TripCardSkeleton";
import { parseFilters, parsePage, searchTrips } from "@/lib/trips";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canBrowseListings, roleHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Trip results | Board95" };

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
  const session = await getSession();
  const preview = !canBrowseListings(session?.user);
  if (preview && session?.user.role === "CAR_HIRER") redirect(roleHome(session.user));
  const params = await searchParams;
  const filters = parseFilters(params);
  const company = filters.company ? await prisma.operator.findFirst({
    where: { id: filters.company, kind: "BUS_COMPANY", ...(preview && session ? { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] } : { active: true, verified: true, OR: [{ ownerId: null }, { owner: { active: true } }] }) },
    select: { name: true },
  }) : null;
  const requestedPage = parsePage(params);
  const sameCity = filters.origin && filters.origin === filters.destination;
  const invalidSearch = Boolean(sameCity || filters.invalidDate || (filters.company && !company));
  const results = invalidSearch
    ? { trips: [], page: 1, pageSize: 12, total: 0 }
    : await searchTrips(filters, requestedPage, preview ? session?.user.id : undefined);
  const hasFilters = Boolean(filters.company || filters.origin || filters.destination || filters.date || filters.type || filters.invalidDate);
  const pageCount = Math.max(1, Math.ceil(results.total / results.pageSize));
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (filters.company) query.set("company", filters.company);
    if (filters.origin) query.set("origin", filters.origin);
    if (filters.destination) query.set("destination", filters.destination);
    if (filters.date) query.set("date", filters.date);
    if (filters.type) query.set("type", filters.type);
    query.set("page", String(page));
    return `/transport?${query.toString()}`;
  };
  return (
    <>
      <PageIntro><p className="dashboard-eyebrow">SEARCH RESULTS</p><h1 className="page-title page-title--plain">{preview ? "Your transport listing previews" : company ? `${company.name} departures` : "Trip results"}</h1><p>Compare available rides or adjust your search below.</p></PageIntro>
      {preview && <p className="notice">Preview your own listings as passengers see them. Booking and contact actions are disabled. <Link href={roleHome(session?.user)}>Back to your dashboard</Link></p>}
      {filters.company && !company && <p className="notice">This bus company is unavailable.</p>}
      <div className="search-panel">
        <SearchForm defaults={filters} />
      </div>

      <div className="results-bar">
        <p>
          {results.total} {results.total === 1 ? "trip" : "trips"} found
        </p>
        {hasFilters && (
          <Link href="/transport" className="chip-link">
            Clear filters
          </Link>
        )}
      </div>

      {sameCity && (
        <p className="notice">
          From and To are the same district. Pick two different districts.
        </p>
      )}

      {filters.invalidDate && (
        <p className="notice" role="alert">That date is invalid. Choose a real calendar date.</p>
      )}

      {!invalidSearch && results.trips.length === 0 ? (
        <p className="empty-state">
          No trips match your search. Try another date or clear the filters.
        </p>
      ) : results.trips.length > 0 ? (
        <div className="trip-grid mt-4 grid gap-4 md:grid-cols-2">
          {results.trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} preview={preview} />
          ))}
        </div>
      ) : null}
      {pageCount > 1 && (
        <nav className="results-pagination" aria-label="Trip result pages">
          {results.page > 1 && <Link className="btn btn-secondary" href={pageHref(results.page - 1)}><ArrowLeft size={16} aria-hidden="true"/>Previous</Link>}
          <span aria-current="page">Page {results.page} of {pageCount}</span>
          {results.page < pageCount && <Link className="btn btn-secondary" href={pageHref(results.page + 1)}><ArrowRight size={16} aria-hidden="true"/>Next</Link>}
        </nav>
      )}
    </>
  );
}
