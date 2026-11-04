import OldListings from "@/components/OldListings";
import type { PageParam } from "@/lib/pagination";

export const metadata = { title: "Old trip listings | Board95" };
export const instant = false;

export default function Page({ searchParams }: { searchParams: Promise<Record<string, PageParam>> }) {
  return <OldListings kind="trip" searchParams={searchParams}/>;
}
