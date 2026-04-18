
CREATE TABLE public.vesselfinder_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id text NOT NULL UNIQUE,
  container_number_override text,
  sealine text,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'queued',
  error_code text,
  error_message text,
  response jsonb,
  last_polled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_vf_tracking_container_id ON public.vesselfinder_tracking(container_id);

ALTER TABLE public.vesselfinder_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vesselfinder tracking"
ON public.vesselfinder_tracking
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vf_tracking_updated_at
BEFORE UPDATE ON public.vesselfinder_tracking
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
