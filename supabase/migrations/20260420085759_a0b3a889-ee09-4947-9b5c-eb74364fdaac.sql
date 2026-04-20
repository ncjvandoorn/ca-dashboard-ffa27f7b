-- Allow active customers to read and activate vesselfinder tracking for their containers.
-- The edge function (vesselfinder-track) enforces business rules (credit deduction, no overrides, no disable).

CREATE POLICY "Customers can read vesselfinder tracking"
ON public.vesselfinder_tracking
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'customer'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.user_id = auth.uid() AND ca.status = 'active'
  )
);

CREATE POLICY "Customers can insert vesselfinder tracking"
ON public.vesselfinder_tracking
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'customer'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.user_id = auth.uid() AND ca.status = 'active'
  )
);

CREATE POLICY "Customers can update vesselfinder tracking"
ON public.vesselfinder_tracking
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'customer'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.user_id = auth.uid() AND ca.status = 'active'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'customer'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.user_id = auth.uid() AND ca.status = 'active'
  )
);

CREATE POLICY "Internal users can read vesselfinder tracking"
ON public.vesselfinder_tracking
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'user'::app_role));