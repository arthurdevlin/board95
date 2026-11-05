"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import CarHirePhoto from "@/components/CarHirePhoto";
import { formatMWK } from "@/lib/format";

export type CarPreview = { id: string; name: string; model: string; photoUrl: string | null; dailyRateMWK: number; district: string; type: string };

export default function CarHireCarousel({ cars }: { cars: CarPreview[] }) {
  const id = useId();
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!cars.length) return null;

  function goTo(index: number) {
    const viewport = track.current;
    if (!viewport) return;
    viewport.scrollTo({ left: index * viewport.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <section className={`hire-carousel${mobileOpen ? " is-open" : ""}`} aria-label="Listed car previews" aria-roledescription="carousel">
    <button className="hire-carousel-mobile-toggle" type="button" aria-expanded={mobileOpen} aria-controls={id} onClick={() => setMobileOpen(!mobileOpen)}>Preview listed cars<ChevronDown size={17} aria-hidden="true"/></button>
    <div className="hire-carousel-body" id={id}>
      <ul className="hire-carousel-track" ref={track} tabIndex={0} aria-label="Car previews. Use left and right arrow keys to browse." onScroll={() => {
        if (track.current) setActive(Math.min(cars.length - 1, Math.max(0, Math.round(track.current.scrollLeft / track.current.clientWidth))));
      }} onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        goTo(event.key === "Home" ? 0 : event.key === "End" ? cars.length - 1 : Math.max(0, Math.min(cars.length - 1, active + (event.key === "ArrowRight" ? 1 : -1))));
      }}>
        {cars.map((car, index) => <li key={car.id} className="hire-carousel-slide" aria-label={`${index + 1} of ${cars.length}`} aria-roledescription="slide" inert={index !== active}>
          <Link className="hire-carousel-photo" href={`/car-hire/${car.id}`} aria-label={`View ${car.name}`}><CarHirePhoto src={car.photoUrl} model={car.model} type={car.type} sizes="(max-width: 760px) 40vw, 220px" loading={index === 0 ? "eager" : "lazy"}/></Link>
          <div className="hire-carousel-details"><p className="hire-carousel-eyebrow">{car.type} · FOR HIRE</p><h2><Link href={`/car-hire/${car.id}`}>{car.name}</Link></h2><p className="hire-carousel-location"><MapPin size={13} aria-hidden="true"/>{car.district}</p><p className="hire-carousel-rate"><strong>{formatMWK(car.dailyRateMWK)}</strong><span>/ day</span></p><Link className="hire-carousel-view" href={`/car-hire/${car.id}`}>View car<ArrowUpRight size={16} aria-hidden="true"/></Link></div>
        </li>)}
      </ul>
      <div className="hire-carousel-controls"><span>{cars.length > 1 ? "Explore the listings" : "Listed on Board95"}</span>{cars.length > 1 && <div><span className="hire-carousel-count" aria-live="polite" aria-atomic="true">{active + 1} / {cars.length}</span><button type="button" aria-label="Previous car" disabled={active === 0} onClick={() => goTo(active - 1)}><ChevronLeft size={18} aria-hidden="true"/></button><button type="button" aria-label="Next car" disabled={active === cars.length - 1} onClick={() => goTo(active + 1)}><ChevronRight size={18} aria-hidden="true"/></button></div>}</div>
    </div>
  </section>;
}
