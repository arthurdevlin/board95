"use client";

import { useId, useState } from "react";
import { ArrowLeftRight, BusFront, CarTaxiFront, Route, Search } from "lucide-react";
import { CITIES, transportLocationName } from "@/lib/cities";
import type { Filters } from "@/lib/trips";
import DateField from "@/components/DateField";

export default function SearchForm({ defaults = {} }: { defaults?: Filters }) {
  return <JourneySearch key={JSON.stringify(defaults)} defaults={defaults}/>;
}

function JourneySearch({ defaults }: { defaults: Filters }) {
  const [origin, setOrigin] = useState(defaults.origin ?? "");
  const [destination, setDestination] = useState(defaults.destination ?? "");
  const [type, setType] = useState(defaults.type ?? (defaults.company ? "bus" : ""));
  const sameCity = Boolean(origin && origin === destination);
  const errorId = useId();

  return <form action="/transport" method="get" className="search-form journey-search" role="search" aria-label="Find transport">
    {defaults.company && type === "bus" && <input type="hidden" name="company" value={defaults.company}/>}
    <fieldset className="transport-toggle">
      <legend>Transport type</legend>
      <div className="transport-toggle-options">
        {[
          { value: "", label: "All rides", Icon: Route },
          { value: "bus", label: "Bus", Icon: BusFront },
          { value: "taxi", label: "Taxi & lifts", Icon: CarTaxiFront },
        ].map(({ value, label, Icon }) => <label key={value} className="transport-toggle-option">
          <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value as typeof type)}/>
          <span><Icon size={17} aria-hidden="true"/>{label}</span>
        </label>)}
      </div>
    </fieldset>
    <div className="journey-search-fields">
      <div className="journey-route-fields">
        <label className="field"><span>From district</span><select name="origin" value={origin} onChange={(event) => setOrigin(event.target.value as typeof origin)}><option value="">Anywhere</option>{CITIES.map((city) => <option key={city} value={city}>{transportLocationName(city)}</option>)}</select></label>
        <button className="journey-swap" type="button" aria-label="Swap departure and destination" onClick={() => { setOrigin(destination); setDestination(origin); }}><ArrowLeftRight size={18} aria-hidden="true"/></button>
        <label className="field"><span>To district</span><select name="destination" value={destination} onChange={(event) => setDestination(event.target.value as typeof destination)} aria-invalid={sameCity || undefined} aria-describedby={sameCity ? errorId : undefined}><option value="">Anywhere</option>{CITIES.map((city) => <option key={city} value={city}>{transportLocationName(city)}</option>)}</select></label>
      </div>
      <DateField defaultValue={defaults.date}/>
      <button type="submit" className="btn btn-primary journey-submit" disabled={sameCity}><Search size={18} aria-hidden="true"/>Find a ride</button>
    </div>
    {sameCity && <p id={errorId} className="journey-validation" role="status">Choose different departure and destination districts.</p>}
  </form>;
}
