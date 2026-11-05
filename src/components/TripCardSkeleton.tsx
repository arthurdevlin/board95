// Match the compact card so streamed results do not shift the layout.
export default function TripCardSkeleton() {
  return <div className="trip-card trip-skeleton" aria-hidden="true">
    <div className="trip-skeleton-header"><span className="skeleton"/><span className="skeleton"/></div>
    <div className="skeleton trip-skeleton-route"/>
    <div className="trip-skeleton-body"><span className="skeleton"/><span className="skeleton"/></div>
    <div className="trip-skeleton-footer"><span className="skeleton"/><span className="skeleton"/></div>
  </div>;
}
