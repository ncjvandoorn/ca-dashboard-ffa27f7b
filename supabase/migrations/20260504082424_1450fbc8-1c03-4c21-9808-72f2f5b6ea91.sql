
CREATE TABLE public.weekly_plan_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_nr INTEGER NOT NULL UNIQUE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  plan_snapshot JSONB,
  routes_snapshot JSONB
);

ALTER TABLE public.weekly_plan_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal can read plan approvals"
  ON public.weekly_plan_approvals FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'user'::app_role) OR has_role(auth.uid(),'ta'::app_role));

CREATE POLICY "Admins can insert plan approvals"
  ON public.weekly_plan_approvals FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can update plan approvals"
  ON public.weekly_plan_approvals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can delete plan approvals"
  ON public.weekly_plan_approvals FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));
