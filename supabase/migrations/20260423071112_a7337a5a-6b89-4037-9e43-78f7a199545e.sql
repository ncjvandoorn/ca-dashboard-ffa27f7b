
-- Vaselife Headers (trial-level)
CREATE TABLE public.vaselife_headers (
  id uuid PRIMARY KEY,
  trial_number text,
  farm text,
  customer text,
  freight_type text,
  initial_quality text,
  harvest_date date,
  start_seafreight date,
  start_transport date,
  start_retail date,
  start_vl date,
  stems_per_vase integer,
  crop text,
  cultivar_count integer,
  treatment_count integer,
  vases_per_treatment integer,
  total_vases integer,
  objective text,
  spec_comments text,
  conclusion text,
  recommendations text,
  source_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Vaselife Vases (treatment per cultivar)
CREATE TABLE public.vaselife_vases (
  id_line text PRIMARY KEY,
  id_header uuid NOT NULL REFERENCES public.vaselife_headers(id) ON DELETE CASCADE,
  cultivar text,
  id_cultivar uuid,
  treatment_no integer,
  vase_count integer,
  treatment_name text,
  id_greenhouse text,
  id_dipping text,
  id_pulsing text,
  post_harvest text,
  store_phase text,
  consumer_phase text,
  climate_room text,
  flv_days numeric,
  bot_percentage numeric,
  flo_percentage numeric,
  source_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vaselife_vases_header ON public.vaselife_vases(id_header);

-- Vaselife Measurements (per-property scores)
CREATE TABLE public.vaselife_measurements (
  id_line_property text PRIMARY KEY,
  id_line text NOT NULL,
  id_header uuid NOT NULL REFERENCES public.vaselife_headers(id) ON DELETE CASCADE,
  cultivar text,
  id_cultivar uuid,
  treatment_no integer,
  id_property uuid,
  property_name text,
  observation_count integer,
  observation_days integer,
  score numeric,
  source_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vaselife_measurements_header ON public.vaselife_measurements(id_header);
CREATE INDEX idx_vaselife_measurements_line ON public.vaselife_measurements(id_line);

-- Enable RLS
ALTER TABLE public.vaselife_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaselife_vases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaselife_measurements ENABLE ROW LEVEL SECURITY;

-- Policies: anyone signed in can read
CREATE POLICY "Authenticated can read vaselife headers"
  ON public.vaselife_headers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read vaselife vases"
  ON public.vaselife_vases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read vaselife measurements"
  ON public.vaselife_measurements FOR SELECT TO authenticated USING (true);

-- Internal (admin/user) can manage
CREATE POLICY "Internal can manage vaselife headers"
  ON public.vaselife_headers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Internal can manage vaselife vases"
  ON public.vaselife_vases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Internal can manage vaselife measurements"
  ON public.vaselife_measurements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- updated_at trigger for headers
CREATE TRIGGER update_vaselife_headers_updated_at
  BEFORE UPDATE ON public.vaselife_headers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
