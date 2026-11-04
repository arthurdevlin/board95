import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { timetableDepartures, timetableDaysLabel } from "../src/lib/bus-timetable.ts";

const daily = [0, 1, 2, 3, 4, 5, 6];

describe("recurring bus timetables", () => {
  it("creates separate service dates for a daily bus across a month boundary", () => {
    const trips = timetableDepartures("06:30", daily, "2026-11-30", 3, new Date("2026-11-29T23:00:00Z"));
    assert.deepEqual(trips.map((trip) => trip.serviceDate), ["2026-11-30", "2026-12-01", "2026-12-02"]);
    assert.equal(trips[0].departureAt.toISOString(), "2026-11-30T04:30:00.000Z");
  });

  it("uses the Malawi service day for departures before UTC midnight", () => {
    const trips = timetableDepartures("00:30", [3], "2026-11-04", 1, new Date("2026-11-03T22:00:00Z"));
    assert.equal(trips[0].serviceDate, "2026-11-04");
    assert.equal(trips[0].departureAt.toISOString(), "2026-11-03T22:30:00.000Z");
  });

  it("does not regenerate a departure that has already left", () => {
    const trips = timetableDepartures("06:30", daily, "2026-11-04", 2, new Date("2026-11-04T04:30:00Z"));
    assert.deepEqual(trips.map((trip) => trip.serviceDate), ["2026-11-05"]);
  });

  it("supports chosen weekdays as well as every-day services", () => {
    const trips = timetableDepartures("12:00", [1, 3, 5], "2026-11-02", 7, new Date("2026-11-01T00:00:00Z"));
    assert.deepEqual(trips.map((trip) => trip.serviceDate), ["2026-11-02", "2026-11-04", "2026-11-06"]);
    assert.equal(timetableDaysLabel(daily), "Every day");
    assert.equal(timetableDaysLabel([5, 1, 3, 1]), "Mon, Wed, Fri");
  });

  it("handles leap days and rejects invalid timetables or unbounded requests", () => {
    assert.deepEqual(timetableDepartures("08:00", daily, "2028-02-28", 3, new Date("2028-02-01T00:00:00Z")).map((trip) => trip.serviceDate), ["2028-02-28", "2028-02-29", "2028-03-01"]);
    for (const [time, date, days] of [["24:00", "2026-11-04", 1], ["08:00", "2026-02-31", 1], ["08:00", "2026-11-04", 32]]) assert.deepEqual(timetableDepartures(time, daily, date, days, new Date()), []);
  });
});
