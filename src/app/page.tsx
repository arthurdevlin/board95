import { Suspense } from "react";
import { connection } from "next/server";
import HomeTripSearch from "@/components/HomeTripSearch";
import TripCardSkeleton from "@/components/TripCardSkeleton";
import DepartingSoon from "@/components/DepartingSoon";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canBrowseListings, roleHome } from "@/lib/access";
import BusCompanyDepartures from "@/components/BusCompanyDepartures";

export default function Home() {
  return <Suspense fallback={<TripCardSkeleton/>}><PublicHome/></Suspense>;
}

async function PublicHome() {
  await connection();
  const session = await getSession();
  if (!canBrowseListings(session?.user)) redirect(roleHome(session?.user));
  return (
    <>
      <section className="hero">
        <h1 className="page-title">
          Travel between Blantyre, Lilongwe and Mzuzu
        </h1>
        <p>
          Find buses and taxis, see fares and available seats, and hire a car
          when you need one.
        </p>
        <HomeTripSearch />
        <p className="dashboard-help"><a href="/bookings/lookup">Already booked? Find your booking by reference</a></p>
      </section>

      <Suspense fallback={<TripCardSkeleton/>}><BusCompanyDepartures/></Suspense>
      <DepartingSoon/>
    </>
  );
}
