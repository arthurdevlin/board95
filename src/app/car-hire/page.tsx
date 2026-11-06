import ServiceReviews from "@/components/ServiceReviews";
import ShareListing from "@/components/ShareListing";
import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatMWK } from "@/lib/format";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, MessageCircle, Phone } from "lucide-react";
import CarHireSearch from "@/components/CarHireSearch";
import { CAR_HIRE_DISTRICTS, carHireDistrictName, type CarHireDistrictCode } from "@/lib/car-hire-districts";
import { parsePageParam, readPage } from "@/lib/pagination";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canBrowseListings, roleHome } from "@/lib/access";
import { MapPin } from "lucide-react";
import CarHirePhoto from "@/components/CarHirePhoto";
import CarHireCarousel from "@/components/CarHireCarousel";

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
    <Suspense fallback={<div className="hire-listings">{Array.from({ length: 4 }, (_, index) => <div className="panel skeleton-card" key={index} />)}</div>}>
      <CarHireListings searchParams={searchParams} />
    </Suspense>
  </section>;
}

async function CarHireListings({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const session = await getSession();
  const preview = !canBrowseListings(session?.user);
  if (preview && session?.user.role !== "CAR_HIRER") redirect(roleHome(session?.user));
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
    expiresAt: { gt: new Date() },
    ...(preview ? { ownerId: session!.user.id } : { available: true }),
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
    select: { id: true, name: true, model: true, vehicleType: true, lorryCapacityTons: true, contactPhone: true, district: true, dailyRateMWK: true, available: true, photoUrl: true },
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
    <div className={`hire-hero${listings.length ? " has-previews" : ""}`}>
      <span className="hero-watermark" aria-hidden="true">95</span>
      <div className="dashboard-intro hire-intro"><p className="dashboard-eyebrow">BOARD95 / {preview ? "YOUR VEHICLES" : "CAR HIRE"}</p><h1 className="page-title page-title--plain">{preview ? "Your car-hire listing previews" : "Find your next car"}</h1><p>{preview ? "Preview your own vehicles. Rental requests and contact actions are disabled." : "Compare cars and daily rates across Malawi."}</p>{!preview && <span className="hire-hero-footnote">Choose a car. Contact the owner. Plan your day. <Link href="/bookings/lookup">Find a rental</Link></span>}{preview && <Link href={roleHome(session?.user)}>Back to your dashboard</Link>}</div>
      <CarHireCarousel key={listings.map(({ id }) => id).join(",")} cars={listings.slice(0, 6).map((listing) => ({ id: listing.id, name: listing.name, model: listing.model, photoUrl: listing.photoUrl, dailyRateMWK: listing.dailyRateMWK, district: carHireDistrictName(listing.district), type: typeLabels[listing.vehicleType] }))}/>
    </div>
    <CarHireSearch key={JSON.stringify([selectedType, selectedDistrict, query])} type={selectedType} district={selectedDistrict} query={query} showPostOption={!preview}/>
    <div className="hire-browse-heading"><h2>{preview ? "Your vehicle previews" : "Available to hire"}</h2><span>{total} {total === 1 ? "vehicle" : "vehicles"} · Rates per day</span></div>
    {!total ? <div className="empty-state">No vehicles match your search. Try another type, district or search term.</div> : <div className="hire-results">
      <div className="hire-listings">{listings.map((listing, index) => <article className="panel hire-card" key={listing.id}>
        <Link href={`/car-hire/${listing.id}`} className="hire-card-photo" aria-label={`View ${listing.name}`}>
          <CarHirePhoto src={listing.photoUrl} model={listing.model} type={typeLabels[listing.vehicleType]} loading={index < 2 ? "eager" : "lazy"}/>
        </Link>
        <div className="hire-card-content">
        <div className="hire-card-meta"><span>{typeLabels[listing.vehicleType]}{listing.vehicleType === "LORRY" && listing.lorryCapacityTons ? ` · ${listing.lorryCapacityTons}t` : ""}</span><span className={`hire-card-availability${listing.available ? "" : " is-unlisted"}`}>{listing.available ? "Available" : "Unlisted"}</span></div>
        <h2><Link href={`/car-hire/${listing.id}`}>{listing.name}</Link></h2>
        <p className="hire-model" title={listing.model}>{listing.model}</p>
        <p className="hire-card-location"><MapPin size={13} aria-hidden="true"/>{carHireDistrictName(listing.district)}</p>
        <ServiceReviews kind="carListingId" id={listing.id} label="Vehicle"/><p className="hire-card-rate"><strong>{formatMWK(listing.dailyRateMWK)}</strong><span>/ day</span></p>
        </div>
        <div className="hire-card-footer"><Link className="btn btn-primary hire-card-action" href={`/car-hire/${listing.id}`}>View car <ArrowUpRight size={16} aria-hidden="true"/></Link>
        {listing.available && <ShareListing path={`/car-hire/${encodeURIComponent(listing.id)}`} title={listing.name} text={`${listing.name} · ${listing.model} for hire in ${carHireDistrictName(listing.district)} · ${formatMWK(listing.dailyRateMWK)} per day on Board95`}/>}
        {listing.contactPhone && !preview && <div className="hire-contact-links"><a href={`tel:${listing.contactPhone}`} aria-label={`Call ${displayPhone(listing.contactPhone)}`}><Phone size={15} aria-hidden="true"/><span className="hire-contact-text">Call</span></a><a href={`https://wa.me/${listing.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label={`Contact ${listing.name} on WhatsApp`}><MessageCircle size={16} aria-hidden="true"/><span className="hire-contact-text">WhatsApp</span></a></div>}
        </div>
      </article>)}</div>
      {pageCount > 1 && <nav className="results-pagination" aria-label="Car hire listing pages">
        {page > 1 ? <Link className="btn btn-secondary" href={pageHref(page - 1)}><ArrowLeft size={16} aria-hidden="true"/>Previous</Link> : <span aria-disabled="true">Previous</span>}
        <span aria-current="page">Page {page} of {pageCount}</span>
        {page < pageCount ? <Link className="btn btn-secondary" href={pageHref(page + 1)}><ArrowRight size={16} aria-hidden="true"/>Next</Link> : <span aria-disabled="true">Next</span>}
      </nav>}
    </div>}
  </>;
}
