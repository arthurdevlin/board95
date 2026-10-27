// A static placeholder shaped like TripCard, shown while <Suspense> waits
// on the database. Prevents the page jumping around once real cards arrive.
export default function TripCardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton" style={{ height: "1.3rem", width: "60%" }} />
      <div className="skeleton" style={{ height: "0.9rem", width: "40%", marginTop: "0.6rem" }} />
      <div className="skeleton" style={{ height: "5.8rem", marginTop: "1rem" }} />
    </div>
  );
}
