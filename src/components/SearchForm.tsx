import { CITIES } from "@/lib/cities";
import type { Filters } from "@/lib/trips";
import DateField from "@/components/DateField";

// A plain HTML form with method GET. On submit the browser goes to
// /transport?origin=...&destination=... No JavaScript needed for the
// search itself — DateField only adds convenience buttons on top.
export default function SearchForm({ defaults = {} }: { defaults?: Filters }) {
  return (
    <form
      key={JSON.stringify(defaults)}
      action="/transport"
      method="get"
      className="search-form"
    >
      <label className="field">
        From
        <select name="origin" defaultValue={defaults.origin ?? ""}>
          <option value="">Anywhere</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">
        To
        <select name="destination" defaultValue={defaults.destination ?? ""}>
          <option value="">Anywhere</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <DateField defaultValue={defaults.date} />
      <label className="field">
        Type
        <select name="type" defaultValue={defaults.type ?? ""}>
          <option value="">Bus or taxi</option>
          <option value="bus">Bus</option>
          <option value="taxi">Taxi</option>
        </select>
      </label>
      <button type="submit" className="btn btn-primary">
        Search
      </button>
    </form>
  );
}
