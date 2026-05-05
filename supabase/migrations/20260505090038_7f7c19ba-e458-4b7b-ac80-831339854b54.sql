
-- Replace blanket authenticated SELECT with role-scoped policies on all 4 vaselife tables.

-- vaselife_headers
DROP POLICY IF EXISTS "Authenticated can read vaselife headers" ON public.vaselife_headers;
CREATE POLICY "Internal can read vaselife headers"
  ON public.vaselife_headers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'user'::app_role)
    OR public.has_role(auth.uid(), 'ta'::app_role)
  );
CREATE POLICY "Customers can read own vaselife headers"
  ON public.vaselife_headers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.customer_accounts ca
      WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.can_see_trials = true
        AND lower(coalesce(ca.company_name,'')) = lower(coalesce(vaselife_headers.customer,''))
    )
  );

-- vaselife_vases
DROP POLICY IF EXISTS "Authenticated can read vaselife vases" ON public.vaselife_vases;
CREATE POLICY "Internal can read vaselife vases"
  ON public.vaselife_vases FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'user'::app_role)
    OR public.has_role(auth.uid(), 'ta'::app_role)
  );
CREATE POLICY "Customers can read own vaselife vases"
  ON public.vaselife_vases FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.vaselife_headers h
      JOIN public.customer_accounts ca ON ca.user_id = auth.uid()
      WHERE h.id = vaselife_vases.id_header
        AND ca.status = 'active'
        AND ca.can_see_trials = true
        AND lower(coalesce(ca.company_name,'')) = lower(coalesce(h.customer,''))
    )
  );

-- vaselife_measurements
DROP POLICY IF EXISTS "Authenticated can read vaselife measurements" ON public.vaselife_measurements;
CREATE POLICY "Internal can read vaselife measurements"
  ON public.vaselife_measurements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'user'::app_role)
    OR public.has_role(auth.uid(), 'ta'::app_role)
  );
CREATE POLICY "Customers can read own vaselife measurements"
  ON public.vaselife_measurements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.vaselife_headers h
      JOIN public.customer_accounts ca ON ca.user_id = auth.uid()
      WHERE h.id = vaselife_measurements.id_header
        AND ca.status = 'active'
        AND ca.can_see_trials = true
        AND lower(coalesce(ca.company_name,'')) = lower(coalesce(h.customer,''))
    )
  );

-- vaselife_trial_ai_analysis
DROP POLICY IF EXISTS "Authenticated can read trial ai analysis" ON public.vaselife_trial_ai_analysis;
CREATE POLICY "Internal can read trial ai analysis"
  ON public.vaselife_trial_ai_analysis FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'user'::app_role)
    OR public.has_role(auth.uid(), 'ta'::app_role)
  );
CREATE POLICY "Customers can read own trial ai analysis"
  ON public.vaselife_trial_ai_analysis FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.vaselife_headers h
      JOIN public.customer_accounts ca ON ca.user_id = auth.uid()
      WHERE h.id = vaselife_trial_ai_analysis.header_id
        AND ca.status = 'active'
        AND ca.can_see_trials = true
        AND lower(coalesce(ca.company_name,'')) = lower(coalesce(h.customer,''))
    )
  );
