CREATE TABLE public.seasonality_report_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_nr integer NOT NULL UNIQUE,
  analysis jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seasonality_report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached seasonality reports" ON public.seasonality_report_cache FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert cached seasonality reports" ON public.seasonality_report_cache FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update cached seasonality reports" ON public.seasonality_report_cache FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete cached seasonality reports" ON public.seasonality_report_cache FOR DELETE TO public USING (true);