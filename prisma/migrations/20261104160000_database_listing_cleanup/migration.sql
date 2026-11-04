-- Database-side equivalent of the application cleanup, for pg_cron scheduling.
-- Each invocation archives a bounded batch in a single transaction.
CREATE OR REPLACE FUNCTION public.board95_archive_expired_listings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  trip_ids text[];
  car_ids text[];
BEGIN
  IF NOT pg_try_advisory_xact_lock(9504111600::bigint) THEN
    RETURN jsonb_build_object('trips', 0, 'carHire', 0, 'alreadyRunning', true);
  END IF;

  SELECT array_agg(expired.id) INTO trip_ids
  FROM (
    SELECT id FROM public."Trip"
    WHERE "departureAt" <= CURRENT_TIMESTAMP - interval '24 hours'
    ORDER BY "departureAt", id LIMIT 1000 FOR UPDATE SKIP LOCKED
  ) expired;

  IF trip_ids IS NOT NULL THEN
    -- Populate the historical row from the original scalars, including service
    -- dates if recurring bus timetables are installed, plus immutable labels.
    INSERT INTO public."TripHistory"
    SELECT snapshot.* FROM public."Trip" t
    JOIN public."Operator" o ON o.id = t."operatorId"
    JOIN public."Vehicle" v ON v.id = t."vehicleId"
    JOIN public."DeparturePoint" d ON d.id = t."departurePointId"
    CROSS JOIN LATERAL jsonb_populate_record(NULL::public."TripHistory",
      to_jsonb(t) || jsonb_build_object('archivedAt', CURRENT_TIMESTAMP,
        'operatorName', o.name, 'vehicleModel', v.model,
        'vehiclePlate', v.plate, 'departurePointName', d.name)) snapshot
    WHERE t.id = ANY(trip_ids);

    UPDATE public."Booking" SET "tripHistoryId" = "tripId", "tripId" = NULL
    WHERE "tripId" = ANY(trip_ids);
    DELETE FROM public."Trip" WHERE id = ANY(trip_ids);
  END IF;

  SELECT array_agg(expired.id) INTO car_ids
  FROM (
    SELECT id FROM public."CarHireListing" WHERE "expiresAt" <= CURRENT_TIMESTAMP
    ORDER BY "expiresAt", id LIMIT 1000 FOR UPDATE SKIP LOCKED
  ) expired;

  IF car_ids IS NOT NULL THEN
    INSERT INTO public."CarHireListingHistory"
    SELECT snapshot.* FROM public."CarHireListing" c
    JOIN public."user" u ON u.id = c."ownerId"
    CROSS JOIN LATERAL jsonb_populate_record(NULL::public."CarHireListingHistory",
      to_jsonb(c) || jsonb_build_object('archivedAt', CURRENT_TIMESTAMP,
        'ownerName', u.name)) snapshot
    WHERE c.id = ANY(car_ids);

    UPDATE public."CarHireRequest" SET "listingHistoryId" = "listingId", "listingId" = NULL
    WHERE "listingId" = ANY(car_ids);
    DELETE FROM public."CarHireListing" WHERE id = ANY(car_ids);
  END IF;

  RETURN jsonb_build_object('trips', COALESCE(cardinality(trip_ids), 0),
    'carHire', COALESCE(cardinality(car_ids), 0));
END;
$$;

-- This maintenance function must never become a public Supabase RPC endpoint.
REVOKE ALL ON FUNCTION public.board95_archive_expired_listings() FROM PUBLIC;
