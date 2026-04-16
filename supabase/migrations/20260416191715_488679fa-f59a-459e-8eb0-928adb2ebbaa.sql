
-- Stores DeviceActivation pushes (one per activation event)
CREATE TABLE public.sensiwatch_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text,
  device_name text,
  org_unit text,
  activation_time timestamptz,
  raw jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sensiwatch_activations_serial ON public.sensiwatch_activations(serial_number);
CREATE INDEX idx_sensiwatch_activations_time ON public.sensiwatch_activations(activation_time DESC);

-- Stores DeviceReport pushes (raw payload + extracted trip)
CREATE TABLE public.sensiwatch_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text,
  device_name text,
  trip_id text,
  trip_guid text,
  internal_trip_id text,
  trailer_id text,
  container_number text,
  mode_of_transport text,
  last_latitude double precision,
  last_longitude double precision,
  last_address text,
  last_temp double precision,
  last_humidity double precision,
  last_light double precision,
  last_device_time timestamptz,
  last_receive_time timestamptz,
  destinations jsonb,
  raw jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sensiwatch_reports_trip ON public.sensiwatch_reports(trip_id);
CREATE INDEX idx_sensiwatch_reports_serial ON public.sensiwatch_reports(serial_number);
CREATE INDEX idx_sensiwatch_reports_time ON public.sensiwatch_reports(last_device_time DESC);
CREATE INDEX idx_sensiwatch_reports_received ON public.sensiwatch_reports(received_at DESC);

-- Aggregated trip view: latest report per trip
CREATE OR REPLACE VIEW public.sensiwatch_trip_latest AS
SELECT DISTINCT ON (trip_id)
  trip_id,
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
FROM public.sensiwatch_reports
WHERE trip_id IS NOT NULL
ORDER BY trip_id, last_device_time DESC NULLS LAST, received_at DESC;

ALTER TABLE public.sensiwatch_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensiwatch_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated internal users (admin + user) can read
CREATE POLICY "Internal users can view activations"
  ON public.sensiwatch_activations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Internal users can view reports"
  ON public.sensiwatch_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

-- No INSERT policies: only the edge function (service role) writes here.
