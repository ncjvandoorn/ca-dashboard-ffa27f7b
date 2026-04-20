CREATE TABLE IF NOT EXISTS public.data_loggers_report_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_nr integer NOT NULL UNIQUE,
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_loggers_report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read data loggers cache"
  ON public.data_loggers_report_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal can insert data loggers cache"
  ON public.data_loggers_report_cache FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Internal can update data loggers cache"
  ON public.data_loggers_report_cache FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Admins can delete data loggers cache"
  ON public.data_loggers_report_cache FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));