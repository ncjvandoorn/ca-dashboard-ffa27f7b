CREATE TABLE public.crm_planner_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_nr integer NOT NULL,
  user_id uuid NOT NULL,
  farm_name text NOT NULL,
  source text NOT NULL DEFAULT 'ai',
  checked boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_planner_confirmations_source_check CHECK (source IN ('ai','added')),
  CONSTRAINT crm_planner_confirmations_unique UNIQUE (week_nr, user_id, farm_name)
);

CREATE INDEX idx_crm_planner_conf_week ON public.crm_planner_confirmations(week_nr);
CREATE INDEX idx_crm_planner_conf_user ON public.crm_planner_confirmations(user_id);

ALTER TABLE public.crm_planner_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal can read planner confirmations"
  ON public.crm_planner_confirmations FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'user'::app_role) OR has_role(auth.uid(),'ta'::app_role));

CREATE POLICY "Internal can insert planner confirmations"
  ON public.crm_planner_confirmations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'user'::app_role) OR has_role(auth.uid(),'ta'::app_role));

CREATE POLICY "Internal can update planner confirmations"
  ON public.crm_planner_confirmations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'user'::app_role) OR has_role(auth.uid(),'ta'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'user'::app_role) OR has_role(auth.uid(),'ta'::app_role));

CREATE POLICY "Internal can delete planner confirmations"
  ON public.crm_planner_confirmations FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'user'::app_role) OR has_role(auth.uid(),'ta'::app_role));

CREATE TRIGGER trg_crm_planner_conf_updated
  BEFORE UPDATE ON public.crm_planner_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();