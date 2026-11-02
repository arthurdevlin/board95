import SearchForm from "@/components/SearchForm";
import HomeTripSearchDialog from "@/components/HomeTripSearchDialog";

export default function HomeTripSearch() {
  return (
    <>
      <div className="home-search-desktop"><SearchForm /></div>
      <HomeTripSearchDialog><SearchForm /></HomeTripSearchDialog>
    </>
  );
}
