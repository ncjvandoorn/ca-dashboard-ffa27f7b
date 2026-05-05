
-- 1) Admin-only logs (PII)
DROP POLICY IF EXISTS "Anyone can read login logs" ON public.login_logs;
CREATE POLICY "Admins can read login logs"
  ON public.login_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read conversation logs" ON public.ai_conversation_logs;
CREATE POLICY "Admins can read conversation logs"
  ON public.ai_conversation_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read question logs" ON public.question_logs;
CREATE POLICY "Admins can read question logs"
  ON public.question_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Report caches: authenticated only (was public)
DROP POLICY IF EXISTS "Anyone can read cached reports" ON public.exception_report_cache;
CREATE POLICY "Authenticated can read exception cache"
  ON public.exception_report_cache FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read cached seasonality reports" ON public.seasonality_report_cache;
CREATE POLICY "Authenticated can read seasonality cache"
  ON public.seasonality_report_cache FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read weekly plan cache" ON public.weekly_plan_cache;
CREATE POLICY "Authenticated can read weekly plan cache"
  ON public.weekly_plan_cache FOR SELECT TO authenticated
  USING (true);

-- 3) Sensiwatch reports — drop overly broad customer policy
DROP POLICY IF EXISTS "Customers can view sensiwatch reports" ON public.sensiwatch_reports;

-- 4) Vesselfinder tracking — scope to records created_by self
DROP POLICY IF EXISTS "Customers can read vesselfinder tracking" ON public.vesselfinder_tracking;
CREATE POLICY "Customers can read own vesselfinder tracking"
  ON public.vesselfinder_tracking FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'customer'::app_role)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.customer_accounts ca WHERE ca.user_id = auth.uid() AND ca.status = 'active')
  );

DROP POLICY IF EXISTS "Customers can update vesselfinder tracking" ON public.vesselfinder_tracking;
CREATE POLICY "Customers can update own vesselfinder tracking"
  ON public.vesselfinder_tracking FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'customer'::app_role)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.customer_accounts ca WHERE ca.user_id = auth.uid() AND ca.status = 'active')
  )
  WITH CHECK (
    has_role(auth.uid(), 'customer'::app_role)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.customer_accounts ca WHERE ca.user_id = auth.uid() AND ca.status = 'active')
  );

DROP POLICY IF EXISTS "Customers can insert vesselfinder tracking" ON public.vesselfinder_tracking;
CREATE POLICY "Customers can insert own vesselfinder tracking"
  ON public.vesselfinder_tracking FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'customer'::app_role)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.customer_accounts ca WHERE ca.user_id = auth.uid() AND ca.status = 'active')
  );

-- 5) Lock down EXECUTE on SECURITY DEFINER functions not meant to be called directly.
--    Keep has_role/get_user_role callable (used inside RLS policies as auth.uid() context).
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_customer_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.monthly_grant_credits() FROM PUBLIC, anon, authenticated;
