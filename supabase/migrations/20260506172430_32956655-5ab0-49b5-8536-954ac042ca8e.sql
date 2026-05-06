
CREATE TABLE public.sf_logger_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  internal_trip_id text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sf_logger_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read logger attachments"
  ON public.sf_logger_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/staff can insert logger attachments"
  ON public.sf_logger_attachments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'ta'));

CREATE POLICY "Admin/staff can update logger attachments"
  ON public.sf_logger_attachments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'ta'));

CREATE POLICY "Admin/staff can delete logger attachments"
  ON public.sf_logger_attachments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'ta'));

CREATE TRIGGER sf_logger_attachments_set_updated_at
  BEFORE UPDATE ON public.sf_logger_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
