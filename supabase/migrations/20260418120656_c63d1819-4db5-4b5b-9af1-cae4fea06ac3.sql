DROP POLICY IF EXISTS "Authenticated can insert question logs" ON public.question_logs;
-- All inserts now go through the log-question edge function using the service role,
-- which bypasses RLS. No client INSERT policy needed.