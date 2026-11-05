import Link from "next/link";
import { ArrowUpRight, BadgeCheck, BusFront, ChevronRight } from "lucide-react";
import { getRegisteredBusCompanies } from "@/lib/trips";

export default async function BusCompanyDepartures() {
  const companies = await getRegisteredBusCompanies();
  return <section className="bus-services-section" aria-labelledby="bus-companies-heading">
    <div className="discovery-section-heading"><h2 id="bus-companies-heading">Choose your favourite bus service</h2><Link href="/transport?type=bus">All buses <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
    {companies.length ? <ul className="bus-company-grid" aria-label="Bus companies">{companies.map((company) => <li key={company.id}><Link href={`/transport?type=bus&company=${encodeURIComponent(company.id)}`} className="bus-company-card" title={`View ${company.name} departures`}>
      <span className="bus-company-icon"><BusFront size={21} aria-hidden="true" /></span>
      <span className="bus-company-name"><strong>{company.name}</strong><span><BadgeCheck size={12} aria-hidden="true" />Verified service</span></span>
      <ChevronRight className="bus-company-arrow" size={15} aria-hidden="true" />
    </Link></li>)}</ul> : <p className="discovery-empty">No bus companies are registered yet.</p>}
    {companies.length > 2 && <p className="bus-services-hint">Scroll across for more companies</p>}
  </section>;
}
