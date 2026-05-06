
CREATE POLICY "Customers can view sensiwatch reports"
ON public.sensiwatch_reports FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'customer'::app_role));

CREATE POLICY "Customers can view sensiwatch activations"
ON public.sensiwatch_activations FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'customer'::app_role));
