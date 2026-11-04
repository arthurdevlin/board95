import Link from "next/link";
import { ArrowUpRight, BusFront } from "lucide-react";
import { getRegisteredBusCompanies } from "@/lib/trips";

export default async function BusCompanyDepartures() {
  const companies = await getRegisteredBusCompanies();
  return <section className="section-gap" aria-labelledby="bus-companies-heading">
    <div className="company-section-heading"><div><p className="dashboard-eyebrow">TRAVEL WITH YOUR PREFERRED COMPANY</p><h2 id="bus-companies-heading" className="section-title">Choose your bus service</h2><p className="dashboard-help">Pick a registered bus company to browse its services.</p></div><Link href="/transport?type=bus" className="chip-link">All bus trips <ArrowUpRight size={16} aria-hidden="true"/></Link></div>
    {companies.length ? <div className="bus-company-grid">{companies.map((company) => <Link href={`/transport?type=bus&company=${encodeURIComponent(company.id)}`} className="bus-company-card" key={company.id}>
      <div className="bus-company-top"><span className="bus-company-icon"><BusFront size={24} aria-hidden="true"/></span><span className="status-badge status-accepted">Verified</span></div>
      <h3>{company.name}</h3>
      <div className="bus-company-footer"><strong>Choose company <ArrowUpRight size={16} aria-hidden="true"/></strong></div>
    </Link>)}</div> : <p className="empty-state mt-4">No bus companies are registered yet.</p>}
  </section>;
}
