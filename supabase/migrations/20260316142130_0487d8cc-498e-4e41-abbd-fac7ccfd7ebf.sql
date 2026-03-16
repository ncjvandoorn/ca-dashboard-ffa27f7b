CREATE TABLE public.question_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  user_email text,
  username text,
  city text,
  country text,
  region text,
  asked_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.question_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert question logs" ON public.question_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read question logs" ON public.question_logs FOR SELECT TO authenticated USING (true);