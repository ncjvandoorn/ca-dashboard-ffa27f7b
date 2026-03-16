-- Table to cache AI exception report analysis results per week
CREATE TABLE public.exception_report_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_nr INTEGER NOT NULL UNIQUE,
  analysis JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Public read/write since no auth in this app
ALTER TABLE public.exception_report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached reports"
  ON public.exception_report_cache FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert cached reports"
  ON public.exception_report_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update cached reports"
  ON public.exception_report_cache FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete cached reports"
  ON public.exception_report_cache FOR DELETE
  USING (true);