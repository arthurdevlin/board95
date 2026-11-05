
import { transportLocationName } from "@/lib/cities";
import { ArrowRight, BadgeCheck, BusFront, CarFront, ChevronDown, MapPin } from "lucide-react";
import { formatDate, formatMWK, formatTimestamp } from "@/lib/format";
import type { TripListing } from "@/lib/trips";
import BookingRequestForm from "@/components/BookingRequestForm";
import { timetableDaysLabel } from "@/lib/bus-timetable";

function getAvailability(left: number, total: number) {
  const remaining = Math.min(Math.max(0, total), Math.max(0, left));
  if (remaining === 0) return { label: "Fully booked", tone: "is-full" };
  if (remaining <= 3) return { label: `Only ${remaining} ${remaining === 1 ? "seat" : "seats"} left`, tone: "is-low" };
  return { label: `${remaining} seats available`, tone: "is-plenty" };
}

export default function TripCard({ trip, preview = false }: { trip: TripListing; preview?: boolean }) {
  const soldOut = trip.seatsAvailable <= 0 || trip.seatsTotal <= 0;
  const isBus = trip.type === "bus";
  const VehicleIcon = isBus ? BusFront : CarFront;
  const availability = getAvailability(trip.seatsAvailable, trip.seatsTotal);
  const departure = `${trip.date}T${trip.departureTime}:00+02:00`;

  return <article className={`trip-card${soldOut ? " trip-card--full" : ""}`} aria-labelledby={`trip-route-${trip.id}`}>
    <header className="trip-card-header">
      <span className="trip-provider-icon"><VehicleIcon size={17} strokeWidth={1.8} aria-hidden="true"/></span>
      <span className="trip-provider-name" title={trip.operator.name}>{trip.operator.name}</span>
      {trip.operator.verified && <span className="trip-verified" title="Verified operator"><BadgeCheck size={16} aria-hidden="true"/><span className="sr-only">Verified operator</span></span>}
      <span className="trip-service-tag">{isBus ? "Bus" : "Taxi"}</span>
    </header>
    <div className="trip-card-body">
      <h3 className="trip-route" id={`trip-route-${trip.id}`}><span>{transportLocationName(trip.origin)}</span><ArrowRight size={16} aria-hidden="true"/><span className="sr-only">to</span><span>{transportLocationName(trip.destination)}</span></h3>
      <div className="trip-departure">
        <div className="trip-departure-line"><time dateTime={departure}>{trip.departureTime}</time><span>{formatDate(trip.date)}</span></div>
        <p className="trip-time-zone">Departure · Malawi time</p>
        <p className="trip-point" title={trip.departurePoint}><MapPin size={13} aria-hidden="true"/><span>{trip.departurePoint}</span></p>
      </div>
      <div className="trip-purchase">
        <span className="trip-fare-label">Fare per seat</span>
        <strong className="trip-fare">{formatMWK(trip.fareMWK)}</strong>
        {preview ? <span className="trip-preview-label">Listing preview</span> : <BookingRequestForm tripId={trip.id} tripLabel={`${transportLocationName(trip.origin)} to ${transportLocationName(trip.destination)} at ${trip.departureTime}`} pickupAvailable={trip.pickup.available} soldOut={soldOut}/>}
      </div>
    </div>
    <details className="trip-disclosure">
      <summary>
        <span className={`trip-availability ${availability.tone}`}>{availability.label}</span>
        <span className="trip-disclosure-action"><span className="trip-disclosure-closed">Trip details</span><span className="trip-disclosure-open">Hide details</span><ChevronDown className="trip-disclosure-chevron" size={14} aria-hidden="true"/></span>
      </summary>
      <div className="trip-details-panel">
        <dl className="trip-detail-grid">
          <div><dt>Vehicle</dt><dd>{trip.vehicle.model}<span className="trip-plate">{trip.vehicle.plate}</span></dd></div>
          <div><dt>Departure point</dt><dd>{trip.departurePoint}</dd></div>
          <div><dt>{trip.operatingDays ? "Operating days" : "Published"}</dt><dd>{trip.operatingDays ? timetableDaysLabel(trip.operatingDays) : formatTimestamp(trip.createdAt)}</dd></div>
          {trip.operator.phone && !preview && <div><dt>Company phone</dt><dd><a href={`tel:${trip.operator.phone.replace(/\s/g, "")}`}>{trip.operator.phone}</a></dd></div>}
          {trip.pickup.available && <div><dt>Optional pickup</dt><dd>{trip.pickup.extraFeeMWK ? `+${formatMWK(trip.pickup.extraFeeMWK)}` : "No extra charge"}</dd></div>}
        </dl>
        {preview && <p className="trip-preview-note">Passenger bookings are disabled in this preview.</p>}
      </div>
    </details>
  </article>;
}
