import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import TripCard from "@/components/TripCard";
import { formatMWK } from "@/lib/format";
import { reviewSeats } from "@/lib/seat-review";
import { getTripForReview } from "@/lib/trips";

export const metadata = {
  title: "Review trip | Board95",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function TripReviewPage(props: Props) {
  return (
    <section className="mx-auto max-w-2xl">
      <Link href="/transport" className="text-sm font-medium text-primary">Find transport</Link>
      <h1 className="my-4 text-2xl font-bold">Review your trip</h1>
      <Suspense fallback={<p className="text-muted">Loading current trip details…</p>}>
        <Review {...props} />
      </Suspense>
    </section>
  );
}

async function Review({ params, searchParams }: Props) {
  await connection();
  const { tripId } = await params;
  const selected = await getTripForReview(tripId);
  if (!selected) notFound();
  const { trip, departed } = selected;
  const query = await searchParams;
  const unavailable = departed || trip.seatsAvailable <= 0;
  const review = reviewSeats(query.seats, trip.seatsAvailable, trip.fareMWK);

  return (
    <>
      <TripCard trip={trip} showReviewLink={false} />
      {unavailable ? (
        <p className="mt-4 rounded-lg bg-secondary/30 p-4" role="status">
          {departed ? "This trip has already departed." : "This trip is now full."} Please choose another trip.
        </p>
      ) : (
        <div className="mt-6 rounded-xl border border-black/10 p-4">
          <form action={`/transport/${encodeURIComponent(trip.id)}`} method="get" className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium" htmlFor="seats">
              Seats
              <input
                key={JSON.stringify(query.seats)}
                id="seats" name="seats" type="number" min={1} max={trip.seatsAvailable} step={1} required
                defaultValue={"seats" in review ? review.seats : (typeof query.seats === "string" ? query.seats : "")}
                aria-invalid={"error" in review}
                aria-describedby={"error" in review ? "seat-error" : undefined}
                className="mt-1 block w-28 rounded-lg border border-black/20 px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:opacity-90">
              Update fare
            </button>
          </form>
          {"error" in review ? (
            <p id="seat-error" role="alert" className="mt-4 text-danger">{review.error}</p>
          ) : (
            <p className="mt-4 font-semibold">
              {review.seats} {review.seats === 1 ? "seat" : "seats"} × {formatMWK(trip.fareMWK)} = {formatMWK(review.subtotalMWK)}
            </p>
          )}
          {trip.pickup.available && (
            <p className="mt-3 text-sm text-muted">Seat fare only. Pickup is not included in this review.</p>
          )}
          <p className="mt-3 text-sm text-muted">
            This is a fare review, not a booking. No seats have been reserved. Booking requests are not available yet.
          </p>
        </div>
      )}
    </>
  );
}
