import { formatDate, formatMWK } from "@/lib/format";
import Link from "next/link";
import type { TripListing } from "@/lib/trips";

// Three clear levels, each with its own colour:
// plenty left = green, running low = amber, none = red.
function getAvailability(left: number, total: number, unit: string) {
  if (left === 0) {
    return { label: "Full", style: "bg-danger/15 text-danger" };
  }
  if (left <= 3) {
    return {
      label: `Only ${left} ${unit} left`,
      style: "bg-secondary/30 text-foreground",
    };
  }
  return {
    label: `${left} of ${total} ${unit} left`,
    style: "bg-accent/15 text-accent",
  };
}

export default function TripCard({ trip, showReviewLink = true }: { trip: TripListing; showReviewLink?: boolean }) {
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

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Departs</dt>
          <dd className="font-medium">
            {formatDate(trip.date)}, {trip.departureTime}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{isBus ? "Bus station" : "Stage"}</dt>
          <dd className="font-medium">{trip.departurePoint}</dd>
        </div>
        <div>
          <dt className="text-muted">Fare</dt>
          <dd className="font-medium">{formatMWK(trip.fareMWK)}</dd>
        </div>
        <div>
          <dt className="text-muted">Vehicle</dt>
          <dd className="font-medium">
            {trip.vehicle.model} · {trip.vehicle.plate}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Availability</dt>
          <dd>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${availability.style}`}
            >
              {availability.label}
            </span>
          </dd>
        </div>
        {operator.phone && (
          <div>
            <dt className="text-muted">Company phone</dt>
            <dd className="font-medium">
              <a href={`tel:${operator.phone.replace(/\s/g, "")}`} className="text-primary">
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

      {showReviewLink && (soldOut ? (
        <p className="mt-4 text-sm font-medium text-muted">Full</p>
      ) : (
        <Link
          href={`/transport/${encodeURIComponent(trip.id)}`}
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Review trip
        </Link>
      ))}
    </article>
  );
}
