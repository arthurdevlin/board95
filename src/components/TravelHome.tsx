import { Suspense } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import HomeTripSearch from "@/components/HomeTripSearch";
import BusCompanyDepartures from "@/components/BusCompanyDepartures";
import DepartingSoon from "@/components/DepartingSoon";

export default function TravelHome({ name }: { name?: string }) {
  return <div className="travel-home">
    <section className="travel-intro" aria-labelledby="travel-home-title">
      <span className="hero-watermark" aria-hidden="true">95</span>
      <div className="travel-intro-heading"><div><p className="dashboard-eyebrow">{name ? `WELCOME, ${name}` : "TRAVEL WITH BOARD95"}</p><h1 id="travel-home-title">Where are you heading?</h1></div><Link className="travel-booking-link" href={name ? "/account#my-bookings" : "/bookings/lookup"}><Ticket size={16} aria-hidden="true"/>{name ? "My bookings" : "Find booking"}</Link></div>
      <p className="travel-intro-copy">Buses, taxis and lifts across Malawi.</p>
      <HomeTripSearch/>
    </section>
    <Suspense fallback={<div className="bus-company-loading" role="status">Loading bus services…</div>}><BusCompanyDepartures/></Suspense>
    <DepartingSoon/>
  </div>;
}
