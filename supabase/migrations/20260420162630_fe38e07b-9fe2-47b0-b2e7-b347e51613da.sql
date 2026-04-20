CREATE OR REPLACE VIEW public.sensiwatch_trip_latest AS
SELECT DISTINCT ON (group_key)
  group_key AS trip_id,
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
  received_at,
  -- True when the most recent reading came from the one-off CSV backfill,
  -- meaning no live API push has arrived for this logger since.
  (raw->>'source' = 'chrysal2026_backfill') AS is_backfill_only
FROM (
  SELECT
    COALESCE(NULLIF(trip_id, ''), NULLIF(internal_trip_id, ''), serial_number) AS group_key,
    *
  FROM public.sensiwatch_reports
  WHERE COALESCE(NULLIF(trip_id, ''), NULLIF(internal_trip_id, ''), serial_number) IS NOT NULL
) r
ORDER BY group_key, last_device_time DESC NULLS LAST, received_at DESC;

ALTER VIEW public.sensiwatch_trip_latest SET (security_invoker = on);