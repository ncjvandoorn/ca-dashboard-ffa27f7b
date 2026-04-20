DROP VIEW IF EXISTS public.customer_credit_balance;

CREATE VIEW public.customer_credit_balance
WITH (security_invoker = true) AS
SELECT
  ca.id AS customer_account_id,
  ca.user_id,
  ca.tier,
  COALESCE(SUM(cl.delta) FILTER (WHERE cl.delta > 0), 0)::int AS total_granted,
  COALESCE(-SUM(cl.delta) FILTER (WHERE cl.delta < 0), 0)::int AS total_consumed,
  COALESCE(SUM(cl.delta), 0)::int AS balance
FROM public.customer_accounts ca
LEFT JOIN public.container_credits_ledger cl
  ON cl.customer_account_id = ca.id
GROUP BY ca.id, ca.user_id, ca.tier;