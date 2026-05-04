CREATE TABLE public.user_expertise (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  expertise text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_expertise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal can read user expertise"
ON public.user_expertise FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

CREATE POLICY "Internal can insert user expertise"
ON public.user_expertise FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

CREATE POLICY "Internal can update user expertise"
ON public.user_expertise FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

CREATE POLICY "Admins can delete user expertise"
ON public.user_expertise FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_user_expertise_updated_at
BEFORE UPDATE ON public.user_expertise
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();