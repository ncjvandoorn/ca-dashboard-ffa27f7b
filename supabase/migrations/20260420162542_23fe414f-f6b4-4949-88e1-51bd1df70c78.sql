-- Replace sensiwatch_trip_latest so it picks the latest reading per trip,
-- using internal_trip_id as a fallback key when Sensitech's numeric trip_id
-- is missing (e.g. for backfilled CSV rows). This makes every datalogger
-- with at least one reading visible on Active SF, regardless of whether the
-- data came from the live push API or the historical backfill.

CREATE OR REPLACE VIEW public.sensiwatch_trip_latest AS
SELECT DISTINCT ON (group_key)
  group_key AS trip_id,                -- exposed as trip_id for backwards compat
  trip_guid,
  internal_trip_id,
  trailer_id,
  container_number,
  mode_of_transport,
  serial_number,
  device_name,
  last_latitude,
  last_longitude,
  last_address,
  last_temp,
  last_humidity,
  last_light,
  last_device_time,
  last_receive_time,
  destinations,
  received_at
FROM (
  SELECT
    -- Prefer live numeric trip_id; fall back to internal_trip_id (e.g. "SO00005990-1")
    -- so backfilled rows surface. Final fallback: serial_number to avoid grouping
    -- multiple unrelated rows together when both ids are missing.
    COALESCE(NULLIF(trip_id, ''), NULLIF(internal_trip_id, ''), serial_number) AS group_key,
    *
  FROM public.sensiwatch_reports
  WHERE COALESCE(NULLIF(trip_id, ''), NULLIF(internal_trip_id, ''), serial_number) IS NOT NULL
) r
ORDER BY group_key, last_device_time DESC NULLS LAST, received_at DESC;