-- 1. Add tier to customer_accounts
ALTER TABLE public.customer_accounts
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'basic';

ALTER TABLE public.customer_accounts
  ADD CONSTRAINT customer_accounts_tier_check CHECK (tier IN ('basic', 'pro'));

-- 2. Permissions matrix table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_key text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults: admin/user get all true; customer_basic limited; customer_pro broader
INSERT INTO public.role_permissions (role_key, permissions) VALUES
  ('admin', '{
    "ai_agent": true, "all_reports": true, "reporting_check": true,
    "seasonality_insights": true, "exception_report": true,
    "containers": true, "active_sf": true, "trial_planner": true,
    "crm_activities": true, "trials_dashboard": true,
    "subscription_plans": true, "settings": true
  }'::jsonb),
  ('user', '{
    "ai_agent": true, "all_reports": true, "reporting_check": true,
    "seasonality_insights": true, "exception_report": true,
    "containers": true, "active_sf": true, "trial_planner": true,
    "crm_activities": true, "trials_dashboard": true,
    "subscription_plans": true, "settings": false
  }'::jsonb),
  ('customer_basic', '{
    "ai_agent": false, "all_reports": true, "reporting_check": false,
    "seasonality_insights": false, "exception_report": false,
    "containers": false, "active_sf": false, "trial_planner": false,
    "crm_activities": false, "trials_dashboard": false,
    "subscription_plans": true, "settings": false
  }'::jsonb),
  ('customer_pro', '{
    "ai_agent": true, "all_reports": true, "reporting_check": false,
    "seasonality_insights": true, "exception_report": true,
    "containers": false, "active_sf": false, "trial_planner": false,
    "crm_activities": false, "trials_dashboard": true,
    "subscription_plans": true, "settings": false
  }'::jsonb)
ON CONFLICT (role_key) DO NOTHING;