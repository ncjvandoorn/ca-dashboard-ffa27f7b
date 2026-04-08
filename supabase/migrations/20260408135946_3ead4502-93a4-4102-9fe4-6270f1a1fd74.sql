CREATE TABLE public.weekly_plan_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_nr integer NOT NULL,
  analysis jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_plan_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read weekly plan cache" ON public.weekly_plan_cache FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert weekly plan cache" ON public.weekly_plan_cache FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update weekly plan cache" ON public.weekly_plan_cache FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete weekly plan cache" ON public.weekly_plan_cache FOR DELETE TO public USING (true);