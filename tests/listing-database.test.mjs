import assert from "node:assert/strict";
import { it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// A real, isolated PostgreSQL engine. No connection to DATABASE_URL is made.
it("migrates, archives and preserves relationships atomically in PostgreSQL", { timeout: 60_000 }, async () => {
  const db = new PGlite();
  try {
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migrations = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    for (const migration of migrations.filter((name) => name < "20261104120000")) {
      await db.exec(readFileSync(new URL(`${migration}/migration.sql`, root), "utf8"));
    }
    await db.exec(`
      INSERT INTO "user" (id, name, email, role, "updatedAt") VALUES ('test-owner', 'Test Owner', 'owner@example.test', 'CAR_HIRER', CURRENT_TIMESTAMP);
      INSERT INTO "Operator" (id, name, kind, "ownerId") VALUES ('test-operator', 'Test Operator', 'BUS_COMPANY', 'test-owner');
      INSERT INTO "Vehicle" (id, "operatorId", model, plate, seats) VALUES ('test-vehicle', 'test-operator', 'Test Bus', 'TEST-001', 30);
      INSERT INTO "DeparturePoint" (id, city, name, kind, "operatorId") VALUES ('test-point', 'Blantyre', 'Test Station', 'STATION', 'test-operator');
      INSERT INTO "Trip" (id, "operatorId", "vehicleId", "departurePointId", type, origin, destination, "departureAt", "fareMWK", "seatsTotal", "seatsAvailable") VALUES
        ('test-expired-trip', 'test-operator', 'test-vehicle', 'test-point', 'BUS', 'Blantyre', 'Lilongwe', CURRENT_TIMESTAMP - interval '25 hours', 20000, 30, 29),
        ('test-recent-trip', 'test-operator', 'test-vehicle', 'test-point', 'BUS', 'Blantyre', 'Lilongwe', CURRENT_TIMESTAMP - interval '23 hours', 20000, 30, 30),
        ('test-future-trip', 'test-operator', 'test-vehicle', 'test-point', 'BUS', 'Blantyre', 'Lilongwe', CURRENT_TIMESTAMP + interval '1 day', 20000, 30, 30);
      INSERT INTO "Booking" (id, "tripId", "userId", seats, "totalMWK", status, "updatedAt", "guestAccessTokenHash") VALUES
        ('test-booking', 'test-expired-trip', 'test-owner', 1, 20000, 'ACCEPTED', CURRENT_TIMESTAMP, 'test-token-hash');
      INSERT INTO "BookingMessage" (id, "bookingId", "senderId", body) VALUES ('test-message', 'test-booking', 'test-owner', 'Keep this conversation');
      INSERT INTO "CarHireListing" (id, "ownerId", name, model, district, "dailyRateMWK", "createdAt") VALUES
        ('test-expired-car', 'test-owner', 'Expired car', 'Test SUV', 'BLANTYRE', 40000, CURRENT_TIMESTAMP - interval '8 days'),
        ('test-renew-car', 'test-owner', 'Renewed car', 'Test Saloon', 'BLANTYRE', 30000, CURRENT_TIMESTAMP - interval '6 days');
      INSERT INTO "CarHireRequest" (id, "listingId", "passengerId", "guestName", "guestPhone", "startsAt", "endsAt", "totalMWK", status, "updatedAt") VALUES
        ('test-request', 'test-expired-car', 'test-owner', 'Test Guest', '0990000000', CURRENT_TIMESTAMP + interval '2 days', CURRENT_TIMESTAMP + interval '4 days', 80000, 'ACCEPTED', CURRENT_TIMESTAMP);
    `);
    for (const migration of migrations.filter((name) => name >= "20261104120000")) {
      await db.exec(readFileSync(new URL(`${migration}/migration.sql`, root), "utf8"));
    }
    assert.equal((await db.query(`SELECT id FROM "CarHireListing" WHERE "expiresAt" < CURRENT_TIMESTAMP`)).rows[0].id, "test-expired-car");
    await db.exec(`UPDATE "CarHireListing" SET "renewedAt" = CURRENT_TIMESTAMP, "expiresAt" = CURRENT_TIMESTAMP + interval '7 days' WHERE id = 'test-renew-car'`);

    const result = await db.query("SELECT public.board95_archive_expired_listings() AS result");
    assert.deepEqual(result.rows[0].result, { trips: 1, carHire: 1 });
    assert.deepEqual((await db.query(`SELECT id FROM "Trip" ORDER BY id`)).rows.map((row) => row.id), ["test-future-trip", "test-recent-trip"]);
    assert.deepEqual((await db.query(`SELECT "operatorName", "vehicleModel", "vehiclePlate", "departurePointName", "fareMWK" FROM "TripHistory"`)).rows[0], { operatorName: "Test Operator", vehicleModel: "Test Bus", vehiclePlate: "TEST-001", departurePointName: "Test Station", fareMWK: 20000 });
    assert.deepEqual((await db.query(`SELECT "tripId", "tripHistoryId", status, "guestAccessTokenHash" FROM "Booking"`)).rows[0], { tripId: null, tripHistoryId: "test-expired-trip", status: "ACCEPTED", guestAccessTokenHash: "test-token-hash" });
    assert.equal((await db.query(`SELECT body FROM "BookingMessage"`)).rows[0].body, "Keep this conversation");
    assert.deepEqual((await db.query(`SELECT "listingId", "listingHistoryId", status FROM "CarHireRequest"`)).rows[0], { listingId: null, listingHistoryId: "test-expired-car", status: "ACCEPTED" });
    assert.equal((await db.query(`SELECT "ownerName" FROM "CarHireListingHistory"`)).rows[0].ownerName, "Test Owner");
    assert.equal((await db.query(`SELECT id FROM "CarHireListing"`)).rows[0].id, "test-renew-car");
    assert.deepEqual((await db.query("SELECT public.board95_archive_expired_listings() AS result")).rows[0].result, { trips: 0, carHire: 0 });

    // Force an error late in cleanup and prove the earlier trip changes roll back.
    await db.exec(`
      UPDATE "Trip" SET "departureAt" = CURRENT_TIMESTAMP - interval '25 hours' WHERE id = 'test-recent-trip';
      UPDATE "CarHireListing" SET "expiresAt" = CURRENT_TIMESTAMP - interval '1 second' WHERE id = 'test-renew-car';
      CREATE FUNCTION fail_test_car_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated deletion failure'; END $$;
      CREATE TRIGGER fail_test_car_delete BEFORE DELETE ON "CarHireListing" FOR EACH ROW EXECUTE FUNCTION fail_test_car_delete();
    `);
    await assert.rejects(db.query("SELECT public.board95_archive_expired_listings()"), /simulated deletion failure/);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM "Trip" WHERE id = 'test-recent-trip'`)).rows[0].n, 1);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM "TripHistory" WHERE id = 'test-recent-trip'`)).rows[0].n, 0);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM "CarHireListingHistory" WHERE id = 'test-renew-car'`)).rows[0].n, 0);
    await db.exec(`DROP TRIGGER fail_test_car_delete ON "CarHireListing"`);
    assert.deepEqual((await db.query("SELECT public.board95_archive_expired_listings() AS result")).rows[0].result, { trips: 1, carHire: 1 });

    await assert.rejects(db.query(`UPDATE "Booking" SET "tripHistoryId" = NULL WHERE id = 'test-booking'`), /Booking_listing_link_check/);
    await assert.rejects(db.query(`DELETE FROM "TripHistory" WHERE id = 'test-expired-trip'`), /foreign key constraint/);
    await assert.rejects(db.query(`UPDATE "CarHireRequest" SET "listingHistoryId" = NULL WHERE id = 'test-request'`), /CarHireRequest_listing_link_check/);
  } finally {
    await db.close();
  }
});
