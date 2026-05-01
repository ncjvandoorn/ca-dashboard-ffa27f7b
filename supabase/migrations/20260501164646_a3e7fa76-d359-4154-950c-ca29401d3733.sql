CREATE TABLE public.vaselife_trial_ai_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id uuid NOT NULL UNIQUE,
  analysis text NOT NULL,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.vaselife_trial_ai_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trial ai analysis"
  ON public.vaselife_trial_ai_analysis FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Internal can insert trial ai analysis"
  ON public.vaselife_trial_ai_analysis FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

CREATE POLICY "Internal can update trial ai analysis"
  ON public.vaselife_trial_ai_analysis FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

CREATE POLICY "Internal can delete trial ai analysis"
  ON public.vaselife_trial_ai_analysis FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

CREATE TRIGGER trg_vaselife_trial_ai_analysis_updated
  BEFORE UPDATE ON public.vaselife_trial_ai_analysis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();