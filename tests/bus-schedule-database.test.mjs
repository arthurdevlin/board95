import assert from "node:assert/strict";
import { it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

it("preserves daily inventory, booked fares and persistent timetables in PostgreSQL", { timeout: 60_000 }, async () => {
  const db = new PGlite(); // Isolated local PostgreSQL; never connects to DATABASE_URL.
  try {
    const root = new URL("../prisma/migrations/", import.meta.url);
    for (const migration of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) await db.exec(readFileSync(new URL(`${migration}/migration.sql`, root), "utf8"));
    await db.exec(`
      INSERT INTO "Operator" (id, name, kind, active, verified) VALUES ('bus-company', 'Bus company', 'BUS_COMPANY', true, true);
      INSERT INTO "Vehicle" (id, "operatorId", model, plate, seats) VALUES ('bus', 'bus-company', 'Coach', 'TEST-BUS', 52);
      INSERT INTO "DeparturePoint" (id, city, name, kind, "operatorId") VALUES ('stage', 'Blantyre', 'Station', 'STATION', 'bus-company');
      INSERT INTO "BusSchedule" (id, "operatorId", "vehicleId", "departurePointId", origin, destination, "departureTime", "fareMWK", "seatsTotal", "updatedAt") VALUES ('daily-service', 'bus-company', 'bus', 'stage', 'Blantyre', 'Lilongwe', '06:30', 18000, 52, CURRENT_TIMESTAMP);
      INSERT INTO "Trip" (id, "scheduleId", "serviceDate", "operatorId", "vehicleId", "departurePointId", type, origin, destination, "departureAt", "fareMWK", "seatsTotal", "seatsAvailable") VALUES
        ('day-one', 'daily-service', '2090-01-01', 'bus-company', 'bus', 'stage', 'BUS', 'Blantyre', 'Lilongwe', '2090-01-01T04:30:00Z', 18000, 52, 51),
        ('day-two', 'daily-service', '2090-01-02', 'bus-company', 'bus', 'stage', 'BUS', 'Blantyre', 'Lilongwe', '2090-01-02T04:30:00Z', 18000, 52, 52);
      INSERT INTO "Booking" (id, "tripId", seats, "totalMWK", status, "updatedAt") VALUES ('reserved', 'day-one', 1, 18000, 'ACCEPTED', CURRENT_TIMESTAMP);
    `);
    assert.deepEqual((await db.query('SELECT weekdays FROM "BusSchedule"')).rows[0].weekdays, [0, 1, 2, 3, 4, 5, 6]);
    await db.exec(`INSERT INTO "Trip" (id, "scheduleId", "serviceDate", "operatorId", "vehicleId", "departurePointId", type, origin, destination, "departureAt", "fareMWK", "seatsTotal", "seatsAvailable") VALUES ('duplicate', 'daily-service', '2090-01-01', 'bus-company', 'bus', 'stage', 'BUS', 'Blantyre', 'Lilongwe', '2090-01-01T06:00:00Z', 20000, 52, 52) ON CONFLICT DO NOTHING;`);
    assert.deepEqual((await db.query('SELECT id, "seatsAvailable" FROM "Trip" ORDER BY id')).rows, [{ id: "day-one", seatsAvailable: 51 }, { id: "day-two", seatsAvailable: 52 }]);

    // Timetable edits regenerate only departures without any booking records.
    await db.exec(`
      UPDATE "BusSchedule" SET "fareMWK" = 20000, "departureTime" = '08:00' WHERE id = 'daily-service';
      DELETE FROM "Trip" t WHERE "scheduleId" = 'daily-service' AND "departureAt" > CURRENT_TIMESTAMP AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."tripId" = t.id);
    `);
    assert.deepEqual((await db.query('SELECT id, "fareMWK", "seatsAvailable" FROM "Trip"')).rows, [{ id: "day-one", fareMWK: 18000, seatsAvailable: 51 }]);
    assert.equal((await db.query('SELECT "totalMWK" FROM "Booking"')).rows[0].totalMWK, 18000);
    assert.equal((await db.query('SELECT "fareMWK" FROM "BusSchedule"')).rows[0].fareMWK, 20000);

    // A one-day exception, including a cancellation, survives later edits to
    // the recurring timetable and keeps its service-date key occupied.
    await db.exec(`
      INSERT INTO "Trip" (id, "scheduleId", "serviceDate", "operatorId", "vehicleId", "departurePointId", type, origin, destination, "departureAt", "fareMWK", "seatsTotal", "seatsAvailable", "scheduleOverride", cancelled) VALUES
        ('day-exception', 'daily-service', '2090-01-03', 'bus-company', 'bus', 'stage', 'BUS', 'Blantyre', 'Lilongwe', '2090-01-03T08:00:00Z', 24000, 52, 52, true, true);
      UPDATE "BusSchedule" SET "fareMWK" = 22000 WHERE id = 'daily-service';
      DELETE FROM "Trip" t WHERE "scheduleId" = 'daily-service' AND "scheduleOverride" = false AND "departureAt" > CURRENT_TIMESTAMP AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."tripId" = t.id);
      INSERT INTO "Trip" (id, "scheduleId", "serviceDate", "operatorId", "vehicleId", "departurePointId", type, origin, destination, "departureAt", "fareMWK", "seatsTotal", "seatsAvailable") VALUES
        ('regenerated-cancelled-day', 'daily-service', '2090-01-03', 'bus-company', 'bus', 'stage', 'BUS', 'Blantyre', 'Lilongwe', '2090-01-03T06:00:00Z', 22000, 52, 52) ON CONFLICT DO NOTHING;
    `);
    assert.deepEqual((await db.query('SELECT id, "fareMWK", cancelled FROM "Trip" WHERE "serviceDate" = $1', ['2090-01-03'])).rows, [{ id: "day-exception", fareMWK: 24000, cancelled: true }]);
    assert.equal((await db.query('SELECT active FROM "Vehicle" WHERE id = $1', ['bus'])).rows[0].active, true);

    // Archiving a departed occurrence must leave its parent timetable running.
    await db.exec(`UPDATE "Trip" SET "departureAt" = CURRENT_TIMESTAMP - interval '25 hours' WHERE id = 'day-one';`);
    assert.deepEqual((await db.query("SELECT public.board95_archive_expired_listings() AS result")).rows[0].result, { trips: 1, carHire: 0 });
    assert.deepEqual((await db.query('SELECT "scheduleId", "serviceDate" FROM "TripHistory"')).rows[0], { scheduleId: "daily-service", serviceDate: "2090-01-01" });
    assert.equal((await db.query('SELECT "tripHistoryId" FROM "Booking"')).rows[0].tripHistoryId, "day-one");
    assert.equal((await db.query('SELECT active FROM "BusSchedule"')).rows[0].active, true);
    // Every new district must be usable in stored routes and departure points.
    const { CITIES } = await import("../src/lib/cities.ts");
    for (const location of CITIES) {
      await db.query('INSERT INTO "DeparturePoint" (id, city, name, kind) VALUES ($1, $2, $3, $4)', ['point-' + location, location, location + ' station', 'STATION']);
      await db.query('INSERT INTO "Trip" (id, "operatorId", "vehicleId", "departurePointId", type, origin, destination, "departureAt", "fareMWK", "seatsTotal", "seatsAvailable") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', ['trip-' + location, 'bus-company', 'bus', 'point-' + location, 'BUS', location, location === 'Lilongwe' ? 'Blantyre' : 'Lilongwe', '2091-01-01T08:00:00Z', 5000, 4, 4]);
    }
    assert.equal((await db.query('SELECT COUNT(*)::integer AS total FROM "Trip" WHERE id LIKE $1', ['trip-%'])).rows[0].total, 29);
    assert.equal((await db.query('SELECT origin FROM "TripHistory" WHERE id = $1', ['day-one'])).rows[0].origin, 'Blantyre');
  } finally { await db.close(); }
});
