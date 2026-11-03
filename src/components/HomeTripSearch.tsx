import SearchForm from "@/components/SearchForm";
import HomeTripSearchDialog from "@/components/HomeTripSearchDialog";
import { CarFront } from "lucide-react";
import Link from "next/link";

export default function HomeTripSearch() {
  return (
    <>
      <div className="home-search-desktop"><SearchForm /></div>
      <div className="home-search-mobile-actions">
        <HomeTripSearchDialog><SearchForm /></HomeTripSearchDialog>
        <Link className="btn home-hire-trigger" href="/car-hire"><CarFront size={18} strokeWidth={2} aria-hidden="true"/>Car hire</Link>
      </div>
    </>
  );
}
