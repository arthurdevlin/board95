"use client";

import { useId, useRef } from "react";

// Typing a date works, but most people are looking for "today" or
// "tomorrow". These chips fill the same input the form already submits,
// so no new server logic is needed — this is presentation only.
export default function DateField({ defaultValue }: { defaultValue?: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Computed inside the click handler, not at render time: reading the
  // current date while the page is being prerendered is treated as an
  // error, since a prerendered page has no "now" of its own.
  function setOffsetDate(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(d.toLocaleDateString("en-CA", { timeZone: "Africa/Blantyre" }));
  }

  function setDate(value: string) {
    if (inputRef.current) inputRef.current.value = value;
  }

  return (
    <div className="field">
      <label htmlFor={id}>Date</label>
      <input
        ref={inputRef}
        id={id}
        type="date"
        name="date"
        defaultValue={defaultValue ?? ""}
      />
      <div className="chip-group">
        <button type="button" className="chip" onClick={() => setOffsetDate(0)}>
          Today
        </button>
        <button type="button" className="chip" onClick={() => setOffsetDate(1)}>
          Tomorrow
        </button>
        <button type="button" className="chip" onClick={() => setDate("")}>
          Any date
        </button>
      </div>
    </div>
  );
}
