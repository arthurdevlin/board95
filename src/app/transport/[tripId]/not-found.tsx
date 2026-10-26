import Link from "next/link";

export default function TripNotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Trip unavailable</h1>
      <p className="mt-3">This trip could not be found or is no longer offered.</p>
      <Link href="/transport" className="mt-4 inline-block font-medium text-primary">Find another trip</Link>
    </section>
  );
}
