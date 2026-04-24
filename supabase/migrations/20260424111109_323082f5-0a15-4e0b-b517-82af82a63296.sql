-- Internal staff (user / ta) can manage vesselfinder tracking like admins
DROP POLICY IF EXISTS "Internal staff can insert vesselfinder tracking" ON public.vesselfinder_tracking;
CREATE POLICY "Internal staff can insert vesselfinder tracking"
  ON public.vesselfinder_tracking FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

DROP POLICY IF EXISTS "Internal staff can update vesselfinder tracking" ON public.vesselfinder_tracking;
CREATE POLICY "Internal staff can update vesselfinder tracking"
  ON public.vesselfinder_tracking FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));

DROP POLICY IF EXISTS "Internal staff can delete vesselfinder tracking" ON public.vesselfinder_tracking;
CREATE POLICY "Internal staff can delete vesselfinder tracking"
  ON public.vesselfinder_tracking FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'ta'::app_role));