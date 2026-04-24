-- Extend "internal" role checks to include the new 'ta' role.
-- Pattern: drop & recreate each policy using a 3-role OR.

-- vesselfinder_tracking: read
DROP POLICY IF EXISTS "Internal users can read vesselfinder tracking" ON public.vesselfinder_tracking;
CREATE POLICY "Internal users can read vesselfinder tracking"
  ON public.vesselfinder_tracking FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- sensiwatch_reports: read
DROP POLICY IF EXISTS "Internal users can view reports" ON public.sensiwatch_reports;
CREATE POLICY "Internal users can view reports"
  ON public.sensiwatch_reports FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- sensiwatch_activations: read
DROP POLICY IF EXISTS "Internal users can view activations" ON public.sensiwatch_activations;
CREATE POLICY "Internal users can view activations"
  ON public.sensiwatch_activations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- container_credits_ledger: read
DROP POLICY IF EXISTS "Internal users can read credits ledger" ON public.container_credits_ledger;
CREATE POLICY "Internal users can read credits ledger"
  ON public.container_credits_ledger FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- crm_settings: read
DROP POLICY IF EXISTS "Users can read crm settings" ON public.crm_settings;
CREATE POLICY "Users can read crm settings"
  ON public.crm_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- ai_instructions: insert/update by internal staff
DROP POLICY IF EXISTS "Internal can insert ai instructions" ON public.ai_instructions;
CREATE POLICY "Internal can insert ai instructions"
  ON public.ai_instructions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));
DROP POLICY IF EXISTS "Internal can update ai instructions" ON public.ai_instructions;
CREATE POLICY "Internal can update ai instructions"
  ON public.ai_instructions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- ai_learnings
DROP POLICY IF EXISTS "Internal can insert ai learnings" ON public.ai_learnings;
CREATE POLICY "Internal can insert ai learnings"
  ON public.ai_learnings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));
DROP POLICY IF EXISTS "Internal can update ai learnings" ON public.ai_learnings;
CREATE POLICY "Internal can update ai learnings"
  ON public.ai_learnings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- ai_conversation_logs insert
DROP POLICY IF EXISTS "Internal can insert conversation logs" ON public.ai_conversation_logs;
CREATE POLICY "Internal can insert conversation logs"
  ON public.ai_conversation_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- exception_report_cache
DROP POLICY IF EXISTS "Internal can insert exception cache" ON public.exception_report_cache;
CREATE POLICY "Internal can insert exception cache"
  ON public.exception_report_cache FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));
DROP POLICY IF EXISTS "Internal can update exception cache" ON public.exception_report_cache;
CREATE POLICY "Internal can update exception cache"
  ON public.exception_report_cache FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- seasonality_report_cache
DROP POLICY IF EXISTS "Internal can insert seasonality cache" ON public.seasonality_report_cache;
CREATE POLICY "Internal can insert seasonality cache"
  ON public.seasonality_report_cache FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));
DROP POLICY IF EXISTS "Internal can update seasonality cache" ON public.seasonality_report_cache;
CREATE POLICY "Internal can update seasonality cache"
  ON public.seasonality_report_cache FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- weekly_plan_cache
DROP POLICY IF EXISTS "Internal can insert weekly plan cache" ON public.weekly_plan_cache;
CREATE POLICY "Internal can insert weekly plan cache"
  ON public.weekly_plan_cache FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));
DROP POLICY IF EXISTS "Internal can update weekly plan cache" ON public.weekly_plan_cache;
CREATE POLICY "Internal can update weekly plan cache"
  ON public.weekly_plan_cache FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- data_loggers_report_cache
DROP POLICY IF EXISTS "Internal can insert data loggers cache" ON public.data_loggers_report_cache;
CREATE POLICY "Internal can insert data loggers cache"
  ON public.data_loggers_report_cache FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));
DROP POLICY IF EXISTS "Internal can update data loggers cache" ON public.data_loggers_report_cache;
CREATE POLICY "Internal can update data loggers cache"
  ON public.data_loggers_report_cache FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

-- vaselife_*
DROP POLICY IF EXISTS "Internal can manage vaselife headers" ON public.vaselife_headers;
CREATE POLICY "Internal can manage vaselife headers"
  ON public.vaselife_headers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

DROP POLICY IF EXISTS "Internal can manage vaselife measurements" ON public.vaselife_measurements;
CREATE POLICY "Internal can manage vaselife measurements"
  ON public.vaselife_measurements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

DROP POLICY IF EXISTS "Internal can manage vaselife vases" ON public.vaselife_vases;
CREATE POLICY "Internal can manage vaselife vases"
  ON public.vaselife_vases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));