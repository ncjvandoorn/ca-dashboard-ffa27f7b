CREATE TABLE public.customer_geocode_cache (
  address_key text PRIMARY KEY,
  name_hint text,
  lat double precision,
  lon double precision,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read geocode cache"
  ON public.customer_geocode_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal can insert geocode cache"
  ON public.customer_geocode_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR has_role(auth.uid(), 'ta'::app_role)
  );

CREATE POLICY "Internal can update geocode cache"
  ON public.customer_geocode_cache FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR has_role(auth.uid(), 'ta'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR has_role(auth.uid(), 'ta'::app_role)
  );

CREATE TRIGGER trg_customer_geocode_cache_updated_at
  BEFORE UPDATE ON public.customer_geocode_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();