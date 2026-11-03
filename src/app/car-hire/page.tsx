import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatMWK } from "@/lib/format";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Phone } from "lucide-react";
import CarHireSearch from "@/components/CarHireSearch";
import { CAR_HIRE_DISTRICTS, carHireDistrictName, type CarHireDistrictCode } from "@/lib/car-hire-districts";
import { parsePageParam, readPage } from "@/lib/pagination";

export const metadata = { title: "Car hire | Board95" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const vehicleTypes = [
  ["SALOON", "Saloon"], ["SUV", "SUV"], ["PICKUP", "Pickup"], ["MINIBUS", "Minibus"],
  ["BUS", "Bus"], ["TRUCK", "Truck"], ["LORRY", "Lorry"], ["VAN", "Van"], ["OTHER", "Other"],
] as const;
const typeLabels = Object.fromEntries(vehicleTypes) as Record<string, string>;
const displayPhone = (phone: string) => phone.replace(/^\+265/, "0");

export default function CarHirePage({ searchParams }: { searchParams: SearchParams }) {
  return <section className="dashboard-page car-hire-page">
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
  const selectedDistrict = value("district");
  const query = value("q").slice(0, 80);
  const requestedPage = parsePageParam(params.page);
  const where = {
    available: true,
    owner: { active: true },
    ...(vehicleTypes.some(([type]) => type === selectedType) ? { vehicleType: selectedType as "SALOON" | "SUV" | "PICKUP" | "MINIBUS" | "BUS" | "TRUCK" | "LORRY" | "VAN" | "OTHER" } : {}),
    ...(CAR_HIRE_DISTRICTS.some(([district]) => district === selectedDistrict) ? { district: selectedDistrict as CarHireDistrictCode } : {}),
    ...(query ? { OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { model: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const pageSize = 12;
  const { total, pageCount, page, rows: listings } = await readPage(requestedPage, pageSize,
    () => prisma.carHireListing.count({ where }),
    (skip, take) => prisma.carHireListing.findMany({
    where,
    select: { id: true, name: true, model: true, vehicleType: true, lorryCapacityTons: true, contactPhone: true, district: true, dailyRateMWK: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip, take,
  }));
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    if (selectedType) next.set("type", selectedType);
    if (selectedDistrict) next.set("district", selectedDistrict);
    if (query) next.set("q", query);
    next.set("page", String(nextPage));
    return `/car-hire?${next.toString()}`;
  };

  return <>
    <CarHireSearch type={selectedType} district={selectedDistrict} query={query}/>
    {!total ? <div className="empty-state">No vehicles match your search. Try another type, district or search term.</div> : <div className="hire-results">
      <div className="results-bar"><p>{total} {total === 1 ? "vehicle" : "vehicles"} available</p></div>
      <div className="hire-listings">{listings.map((listing) => <article className="panel hire-card" key={listing.id}>
        <div className="hire-card-top"><div><p className="dashboard-eyebrow">{carHireDistrictName(listing.district)} · {typeLabels[listing.vehicleType]}{listing.vehicleType === "LORRY" && listing.lorryCapacityTons ? ` · ${listing.lorryCapacityTons} ton${listing.lorryCapacityTons === 1 ? "" : "s"}` : ""}</p><h2>{listing.name}</h2></div><span className="status-badge status-accepted">Available</span></div>
        <p className="hire-model">{listing.model}</p>
        <div className="hire-card-bottom"><strong>{formatMWK(listing.dailyRateMWK)} <span>/ day</span></strong><Link className="btn btn-primary hire-card-action" href={`/car-hire/${listing.id}`}>View car <ArrowUpRight size={16} aria-hidden="true"/></Link></div>
        {listing.contactPhone && <div className="hire-contact-links"><a href={`tel:${listing.contactPhone}`} aria-label={`Call ${displayPhone(listing.contactPhone)}`}><Phone size={15} aria-hidden="true"/>{displayPhone(listing.contactPhone)}</a><a href={`https://wa.me/${listing.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true"/>WhatsApp</a></div>}
      </article>)}</div>
      {pageCount > 1 && <nav className="results-pagination" aria-label="Car hire listing pages">
        {page > 1 ? <Link className="btn btn-secondary" href={pageHref(page - 1)}>Previous</Link> : <span aria-disabled="true">Previous</span>}
        <span aria-current="page">Page {page} of {pageCount}</span>
        {page < pageCount ? <Link className="btn btn-secondary" href={pageHref(page + 1)}>Next</Link> : <span aria-disabled="true">Next</span>}
      </nav>}
    </div>}
  </>;
}
