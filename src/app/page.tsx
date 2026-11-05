import { Suspense } from "react";
import { connection } from "next/server";
import TripCardSkeleton from "@/components/TripCardSkeleton";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canBrowseListings, roleHome } from "@/lib/access";
import TravelHome from "@/components/TravelHome";

export default function Home() {
  return <Suspense fallback={<TripCardSkeleton/>}><PublicHome/></Suspense>;
}

async function PublicHome() {
  await connection();
  const session = await getSession();
  if (!canBrowseListings(session?.user)) redirect(roleHome(session?.user));
  return <TravelHome/>;
}
