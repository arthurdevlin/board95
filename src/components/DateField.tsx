"use client";

import { useId, useState } from "react";
import { TIME_ZONE } from "@/lib/dates";

// Typing a date works, but most people are looking for "today" or
// "tomorrow". These chips fill the same input the form already submits,
// so no new server logic is needed — this is presentation only.
export default function DateField({ defaultValue }: { defaultValue?: string }) {
  const id = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const [quickDate, setQuickDate] = useState<"today" | "tomorrow" | "any" | null>(defaultValue ? null : "any");

  // Computed inside the click handler, not at render time: reading the
  // current date while the page is being prerendered is treated as an
  // error, since a prerendered page has no "now" of its own.
  function setOffsetDate(days: number) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const date = new Date(Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + days,
    ));
    setValue([
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-"));
    setQuickDate(days === 0 ? "today" : "tomorrow");
  }

  return (
    <div className="field">
      <label htmlFor={id}>Date</label>
      <input
        id={id}
        type="date"
        name="date"
        value={value}
        onChange={(event) => { setValue(event.target.value); setQuickDate(event.target.value ? null : "any"); }}
      />
      <div className="chip-group" role="group" aria-label="Quick date options">
        <button type="button" className="chip" aria-pressed={quickDate === "today"} onClick={() => setOffsetDate(0)}>
          Today
        </button>
        <button type="button" className="chip" aria-pressed={quickDate === "tomorrow"} onClick={() => setOffsetDate(1)}>
          Tomorrow
        </button>
        <button type="button" className="chip" aria-pressed={quickDate === "any"} onClick={() => { setValue(""); setQuickDate("any"); }}>
          Any date
        </button>
      </div>
    </div>
  );
}
