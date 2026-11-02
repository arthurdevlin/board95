import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatMWK } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Car hire | Board95" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const vehicleTypes = [
  ["SALOON", "Saloon"], ["SUV", "SUV"], ["PICKUP", "Pickup"], ["MINIBUS", "Minibus"],
  ["BUS", "Bus"], ["TRUCK", "Truck"], ["LORRY", "Lorry"], ["VAN", "Van"], ["OTHER", "Other"],
] as const;
const typeLabels = Object.fromEntries(vehicleTypes) as Record<string, string>;
const displayPhone = (phone: string) => phone.replace(/^\+265/, "0");

export default function CarHirePage({ searchParams }: { searchParams: SearchParams }) {
  return <section className="dashboard-page">
    <div className="dashboard-intro"><p className="dashboard-eyebrow">SELF-DRIVE RENTALS</p><h1 className="page-title page-title--plain">Car hire in Malawi</h1><p>Browse vehicles available from local car-hire owners.</p></div>
    <Suspense fallback={<div className="hire-listings">{Array.from({ length: 4 }, (_, index) => <div className="panel skeleton-card" key={index} />)}</div>}>
      <CarHireListings searchParams={searchParams} />
    </Suspense>
  </section>;
}

async function CarHireListings({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  };
  const selectedType = value("type");
  const selectedCity = value("city");
  const query = value("q").slice(0, 80);
  const rawPage = value("page");
  const requestedPage = rawPage && /^\d+$/.test(rawPage) ? Math.min(100_000, Number(rawPage)) : 1;
  const where = {
    available: true,
    owner: { active: true },
    ...(vehicleTypes.some(([type]) => type === selectedType) ? { vehicleType: selectedType as "SALOON" | "SUV" | "PICKUP" | "MINIBUS" | "BUS" | "TRUCK" | "LORRY" | "VAN" | "OTHER" } : {}),
    ...( ["Blantyre", "Lilongwe", "Mzuzu"].includes(selectedCity) ? { city: selectedCity as "Blantyre" | "Lilongwe" | "Mzuzu" } : {}),
    ...(query ? { OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { model: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const pageSize = 12;
  const total = await prisma.carHireListing.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const listings = await prisma.carHireListing.findMany({
    where,
    select: { id: true, name: true, model: true, vehicleType: true, lorryCapacityTons: true, contactPhone: true, city: true, createdAt: true, description: true, dailyRateMWK: true, owner: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    if (selectedType) next.set("type", selectedType);
    if (selectedCity) next.set("city", selectedCity);
    if (query) next.set("q", query);
    next.set("page", String(nextPage));
    return `/car-hire?${next.toString()}`;
  };

  return <>
    <form className="hire-search-form" method="get" action="/car-hire" role="search">
      <label className="field"><span>Vehicle type</span><select name="type" defaultValue={selectedType}><option value="">All vehicle types</option>{vehicleTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
      <label className="field"><span>City</span><select name="city" defaultValue={selectedCity}><option value="">All cities</option><option value="Blantyre">Blantyre</option><option value="Lilongwe">Lilongwe</option><option value="Mzuzu">Mzuzu</option></select></label>
      <label className="field hire-search-keyword"><span>Search</span><input type="search" name="q" maxLength={80} defaultValue={query} placeholder="Name, model or details"/></label>
      <button className="btn btn-primary" type="submit">Search vehicles</button>
    </form>
    {!total ? <div className="empty-state">No vehicles match your search. Try another type, city or search term.</div> : <>
      <div className="results-bar"><p>{total} {total === 1 ? "vehicle" : "vehicles"} available</p></div>
      <div className="hire-listings">{listings.map((listing) => <article className="panel hire-card" key={listing.id}>
        <div className="hire-card-top"><div><p className="dashboard-eyebrow">{listing.city} · {typeLabels[listing.vehicleType]}{listing.vehicleType === "LORRY" && listing.lorryCapacityTons ? ` · ${listing.lorryCapacityTons} ton${listing.lorryCapacityTons === 1 ? "" : "s"}` : ""}</p><h2>{listing.name}</h2></div><span className="status-badge status-accepted">Available</span></div>
        <p className="hire-model">{listing.model}</p>
        <p className="field-hint">Posted {new Intl.DateTimeFormat("en-MW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Blantyre" }).format(listing.createdAt)}</p>
        {listing.description && <p className="hire-description">{listing.description}</p>}
        <div className="hire-card-bottom"><strong>{formatMWK(listing.dailyRateMWK)} <span>/ day</span></strong><span>Listed by {listing.owner.name}</span></div>
        {listing.contactPhone && <div className="hire-contact-links"><a href={`tel:${listing.contactPhone}`}>Call {displayPhone(listing.contactPhone)}</a><a href={`https://wa.me/${listing.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a></div>}
        <Link className="btn btn-primary hire-card-action" href={`/car-hire/${listing.id}`}>View vehicle</Link>
      </article>)}</div>
      {pageCount > 1 && <nav className="results-pagination" aria-label="Car hire listing pages">
        {page > 1 ? <Link className="btn btn-secondary" href={pageHref(page - 1)}>Previous</Link> : <span aria-disabled="true">Previous</span>}
        <span aria-current="page">Page {page} of {pageCount}</span>
        {page < pageCount ? <Link className="btn btn-secondary" href={pageHref(page + 1)}>Next</Link> : <span aria-disabled="true">Next</span>}
      </nav>}
    </>}
  </>;
}
