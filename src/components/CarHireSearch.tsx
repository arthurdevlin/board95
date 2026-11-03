"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { CAR_HIRE_DISTRICTS } from "@/lib/car-hire-districts";

const vehicleTypes = [
  ["SALOON", "Saloon"], ["SUV", "SUV"], ["PICKUP", "Pickup"], ["MINIBUS", "Minibus"],
  ["BUS", "Bus"], ["TRUCK", "Truck"], ["LORRY", "Lorry"], ["VAN", "Van"], ["OTHER", "Other"],
] as const;

export default function CarHireSearch({ type, district, query }: { type: string; district: string; query: string }) {
  const [expanded, setExpanded] = useState(false);
  return <div className={`hire-search-shell${expanded ? " is-expanded" : ""}`}>
    <button className="hire-search-toggle" type="button" aria-expanded={expanded} aria-controls="hire-search-form" onClick={() => setExpanded((value) => !value)}>
      <Search aria-hidden="true" size={18}/><span>{expanded ? "Search filters" : "Search for a car"}</span><ChevronDown className="hire-search-chevron" aria-hidden="true" size={17}/>
    </button>
    <form id="hire-search-form" className="hire-search-form" method="get" action="/car-hire" role="search">
      <label className="field"><span>Vehicle type</span><select name="type" defaultValue={type}><option value="">Any type</option>{vehicleTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field"><span>District</span><select name="district" defaultValue={district}><option value="">All districts</option>{CAR_HIRE_DISTRICTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field hire-search-keyword"><span>Search</span><input type="search" name="q" maxLength={80} defaultValue={query} placeholder="Name, model or details"/></label>
      <button className="btn btn-primary" type="submit">Search vehicles</button>
    </form>
  </div>;
}
