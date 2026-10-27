import { formatDate, formatMWK } from "@/lib/format";
import type { TripListing } from "@/lib/trips";

// Three clear levels, each with its own colour:
// plenty left = green, running low = amber, none = red.
function getAvailability(left: number, total: number, unit: string) {
  if (left === 0) {
    return { label: "Full", tone: "is-full" };
  }
  if (left <= 3) {
    return { label: `Only ${left} ${unit} left`, tone: "is-low" };
  }
  return { label: `${left} of ${total} ${unit} left`, tone: "is-plenty" };
}

export default function TripCard({ trip }: { trip: TripListing }) {
  const soldOut = trip.seatsAvailable === 0;
  const isBus = trip.type === "bus";
  const unit = isBus ? "seats" : "spaces";
  const { operator } = trip;
  const availability = getAvailability(trip.seatsAvailable, trip.seatsTotal, unit);

  return (
    <article className="rounded-xl border border-black/10 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            {trip.origin} → {trip.destination}
          </h3>
          <p className="text-sm text-muted">
            {isBus ? operator.name : `Owner: ${operator.name}`}
            {operator.verified && (
              <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">
                ✓ Verified
              </span>
            )}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
          {isBus ? "Bus" : "Taxi"}
        </span>
      </div>

      <p className="trip-point">{trip.departurePoint}</p>

      <details className="trip-disclosure">
        <summary>
          <span className="trip-summary-primary">
            <span className="trip-summary-departure">
              <span className="trip-summary-label">Departs</span>
              <span className="trip-summary-date">{formatDate(trip.date)}</span>
              <time className="trip-summary-time">{trip.departureTime}</time>
            </span>
            <span className="trip-summary-fare">
              <span className="trip-summary-label">Fare</span>
              <strong>{formatMWK(trip.fareMWK)}</strong>
            </span>
          </span>
          <span className="trip-summary-secondary">
            <span className={`trip-availability ${availability.tone}`}>
              {availability.label}
            </span>
            <span className="trip-disclosure-action">
              <span className="trip-disclosure-closed">More details</span>
              <span className="trip-disclosure-open">Less details</span>
              <span className="trip-disclosure-chevron" aria-hidden="true" />
            </span>
          </span>
        </summary>

        <div className="trip-details-panel">
          <h4 className="trip-details-heading">Trip information</h4>
          <dl className="trip-detail-grid">
            <div>
              <dt>Vehicle</dt>
              <dd className="trip-vehicle-value">
                <span>{trip.vehicle.model}</span>
                <span className="trip-plate">{trip.vehicle.plate}</span>
              </dd>
            </div>
            {operator.phone && (
              <div>
                <dt>Company phone</dt>
                <dd>
                  <a href={`tel:${operator.phone.replace(/\s/g, "")}`}>
                    {operator.phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {trip.pickup.available && (
            <p className="mt-3 text-sm">
              <span className="rounded bg-secondary/30 px-2 py-0.5 font-medium">
                Pickup available
              </span>{" "}
              <span className="text-muted">+{formatMWK(trip.pickup.extraFeeMWK ?? 0)}</span>
            </p>
          )}

        </div>
      </details>

      <div className="trip-cta">
        <button type="button" className="btn btn-primary btn-block" disabled>
          {soldOut ? "Full" : "Request a seat (coming soon)"}
        </button>
      </div>
    </article>
  );
}
