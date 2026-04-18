-- Helper: a row passes write checks if the caller is admin or internal user
-- We replace the permissive "true" write policies with role-gated ones.

-- ai_instructions
DROP POLICY IF EXISTS "Anyone can insert ai instructions" ON public.ai_instructions;
DROP POLICY IF EXISTS "Anyone can update ai instructions" ON public.ai_instructions;
CREATE POLICY "Internal can insert ai instructions"
  ON public.ai_instructions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Internal can update ai instructions"
  ON public.ai_instructions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

-- ai_learnings
DROP POLICY IF EXISTS "Anyone can insert ai learnings" ON public.ai_learnings;
DROP POLICY IF EXISTS "Anyone can update ai learnings" ON public.ai_learnings;
CREATE POLICY "Internal can insert ai learnings"
  ON public.ai_learnings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Internal can update ai learnings"
  ON public.ai_learnings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

-- ai_conversation_logs (insert only, no update policy exists)
DROP POLICY IF EXISTS "Anyone can insert conversation logs" ON public.ai_conversation_logs;
CREATE POLICY "Internal can insert conversation logs"
  ON public.ai_conversation_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

-- login_logs (insert only)
DROP POLICY IF EXISTS "Anyone can insert login logs" ON public.login_logs;
CREATE POLICY "Authenticated can insert own login log"
  ON public.login_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- question_logs (insert only) – any authenticated user may log their own question
DROP POLICY IF EXISTS "Anyone can insert question logs" ON public.question_logs;
CREATE POLICY "Authenticated can insert question logs"
  ON public.question_logs FOR INSERT TO authenticated
  WITH CHECK (true);
-- (kept open for inserts because customers also use the AI agent;
--  reads stay restricted to authenticated, no UPDATE/DELETE allowed)

-- exception_report_cache
DROP POLICY IF EXISTS "Anyone can insert cached reports" ON public.exception_report_cache;
DROP POLICY IF EXISTS "Anyone can update cached reports" ON public.exception_report_cache;
DROP POLICY IF EXISTS "Anyone can delete cached reports" ON public.exception_report_cache;
CREATE POLICY "Internal can insert exception cache"
  ON public.exception_report_cache FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Internal can update exception cache"
  ON public.exception_report_cache FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Admins can delete exception cache"
  ON public.exception_report_cache FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- seasonality_report_cache
DROP POLICY IF EXISTS "Anyone can insert cached seasonality reports" ON public.seasonality_report_cache;
DROP POLICY IF EXISTS "Anyone can update cached seasonality reports" ON public.seasonality_report_cache;
DROP POLICY IF EXISTS "Anyone can delete cached seasonality reports" ON public.seasonality_report_cache;
CREATE POLICY "Internal can insert seasonality cache"
  ON public.seasonality_report_cache FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Internal can update seasonality cache"
  ON public.seasonality_report_cache FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Admins can delete seasonality cache"
  ON public.seasonality_report_cache FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- weekly_plan_cache
DROP POLICY IF EXISTS "Anyone can insert weekly plan cache" ON public.weekly_plan_cache;
DROP POLICY IF EXISTS "Anyone can update weekly plan cache" ON public.weekly_plan_cache;
DROP POLICY IF EXISTS "Anyone can delete weekly plan cache" ON public.weekly_plan_cache;
CREATE POLICY "Internal can insert weekly plan cache"
  ON public.weekly_plan_cache FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Internal can update weekly plan cache"
  ON public.weekly_plan_cache FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Admins can delete weekly plan cache"
  ON public.weekly_plan_cache FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));