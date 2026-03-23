CREATE TABLE public.ai_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructions text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai instructions" ON public.ai_instructions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can update ai instructions" ON public.ai_instructions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anyone can insert ai instructions" ON public.ai_instructions FOR INSERT TO authenticated WITH CHECK (true);

-- Seed with a single row
INSERT INTO public.ai_instructions (instructions) VALUES ('');