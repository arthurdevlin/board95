import { CITIES } from "@/lib/cities";
import type { Filters } from "@/lib/trips";

const field =
  "w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-foreground";

// A plain HTML form with method GET. On submit the browser goes to
// /transport?origin=...&destination=... No JavaScript needed, and every
// search has a shareable, bookmarkable URL.
export default function SearchForm({ defaults = {} }: { defaults?: Filters }) {
  return (
    <form
      key={JSON.stringify(defaults)}
      action="/transport"
      method="get"
      className="grid gap-3 rounded-xl bg-white p-4 text-foreground shadow-sm sm:grid-cols-2 lg:grid-cols-5"
    >
      <label className="text-sm font-medium">
        From
        <select name="origin" defaultValue={defaults.origin ?? ""} className={field}>
          <option value="">Anywhere</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">
        To
        <select name="destination" defaultValue={defaults.destination ?? ""} className={field}>
          <option value="">Anywhere</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">
        Date
        <input type="date" name="date" defaultValue={defaults.date ?? ""} className={field} />
      </label>
      <label className="text-sm font-medium">
        Type
        <select name="type" defaultValue={defaults.type ?? ""} className={field}>
          <option value="">Bus or taxi</option>
          <option value="bus">Bus</option>
          <option value="taxi">Taxi</option>
        </select>
      </label>
      <button
        type="submit"
        className="self-end rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:opacity-90"
      >
        Search
      </button>
    </form>
  );
}
