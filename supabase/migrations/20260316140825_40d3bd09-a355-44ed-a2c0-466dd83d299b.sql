CREATE TABLE public.login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  username text NOT NULL,
  ip_address text,
  city text,
  country text,
  region text,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read login logs" ON public.login_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert login logs" ON public.login_logs FOR INSERT TO authenticated WITH CHECK (true);