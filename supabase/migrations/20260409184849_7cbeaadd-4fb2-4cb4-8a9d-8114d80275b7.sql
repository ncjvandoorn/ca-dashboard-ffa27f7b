
CREATE TABLE public.crm_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visible_user_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crm settings"
ON public.crm_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read crm settings"
ON public.crm_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'user'));

-- Seed a single row
INSERT INTO public.crm_settings (visible_user_ids) VALUES ('{}');
