"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Plus, SlidersHorizontal, Search } from "lucide-react";
import Link from "next/link";
import { CAR_HIRE_DISTRICTS } from "@/lib/car-hire-districts";

const vehicleTypes = [
  ["SALOON", "Saloon"], ["SUV", "SUV"], ["PICKUP", "Pickup"], ["MINIBUS", "Minibus"],
  ["BUS", "Bus"], ["TRUCK", "Truck"], ["LORRY", "Lorry"], ["VAN", "Van"], ["OTHER", "Other"],
] as const;

export default function CarHireSearch({ type, district, query, showPostOption = true }: { type: string; district: string; query: string; showPostOption?: boolean }) {
  const hasFilters = Boolean(type || district || query);
  const [expanded, setExpanded] = useState(hasFilters);
  const [vehicleType, setVehicleType] = useState(type);
  const typeRail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = typeRail.current;
    const selected = rail?.querySelector<HTMLInputElement>("input:checked")?.parentElement;
    if (!rail?.clientWidth || !selected) return;
    const bounds = rail.getBoundingClientRect();
    const choice = selected.getBoundingClientRect();
    if (choice.left < bounds.left || choice.right > bounds.right) {
      rail.scrollTo({ left: rail.scrollLeft + choice.left - bounds.left - (bounds.width - choice.width) / 2, behavior: "instant" });
    }
  }, [vehicleType, expanded]);
  return <div className={`hire-search-shell${expanded ? " is-expanded" : ""}`}>
    <div className={`hire-choice-grid${showPostOption ? "" : " hire-choice-grid--single"}`}>
      <button className={`hire-choice hire-choice--search${expanded ? " is-selected" : ""}`} type="button" aria-expanded={expanded} aria-controls="hire-search-form" onClick={() => setExpanded((value) => !value)}>
        <span className="hire-choice-icon"><SlidersHorizontal aria-hidden="true" size={19}/></span><span><strong className="hire-choice-title">Search for a car</strong><span className="hire-choice-copy">{type || district || query ? "Refine your search" : "Type, location & model"}</span></span>
      </button>
      {showPostOption && <Link className="hire-choice hire-choice--post" href="/sign-up?accountType=CAR_HIRER">
        <span className="hire-choice-icon"><Plus aria-hidden="true" size={20}/></span><span><strong className="hire-choice-title">Post your car</strong><span className="hire-choice-copy">Sign up as an owner</span></span><ArrowUpRight className="hire-choice-arrow" aria-hidden="true" size={17}/>
      </Link>}
    </div>
    <form id="hire-search-form" className="hire-search-form" hidden={!expanded} method="get" action="/car-hire" role="search" aria-label="Search cars for hire">
      <fieldset className="hire-type-toggle"><legend>Vehicle type</legend><div ref={typeRail}>{[["", "All types"], ...vehicleTypes].map(([value, label]) => <label key={value}><input type="radio" name="type" value={value} checked={vehicleType === value} onChange={() => setVehicleType(value)}/><span>{label}</span></label>)}</div></fieldset>
      <label className="field hire-search-keyword"><span>Make, model or keyword</span><input type="search" name="q" maxLength={80} defaultValue={query} placeholder="e.g. Toyota Fortuner"/></label>
      <label className="field"><span>District</span><select name="district" defaultValue={district}><option value="">All districts</option>{CAR_HIRE_DISTRICTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="btn btn-primary" type="submit"><Search size={17} aria-hidden="true"/>Search vehicles</button>
      {hasFilters && <Link className="hire-clear-filters" href="/car-hire">Clear filters</Link>}
    </form>
  </div>;
}
