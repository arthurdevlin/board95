import Link from "next/link";

export default function TripNotFound() {
  return <section className="dashboard-page"><h1 className="page-title">Trip unavailable</h1><p>This trip may have departed or is no longer listed.</p><Link className="btn btn-primary" href="/transport">Find another trip</Link></section>;
}
