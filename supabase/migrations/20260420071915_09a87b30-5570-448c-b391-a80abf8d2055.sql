
-- 1. Extend customer_accounts
ALTER TABLE public.customer_accounts
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Validate billing_cycle and status via trigger (not CHECK, per project rules)
CREATE OR REPLACE FUNCTION public.validate_customer_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.billing_cycle NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'billing_cycle must be monthly or yearly';
  END IF;
  IF NEW.status NOT IN ('pending', 'active', 'suspended') THEN
    RAISE EXCEPTION 'status must be pending, active or suspended';
  END IF;
  IF NEW.tier NOT IN ('basic', 'pro', 'proPlus', 'heavy') THEN
    RAISE EXCEPTION 'tier must be basic, pro, proPlus or heavy';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_customer_account_trg ON public.customer_accounts;
CREATE TRIGGER validate_customer_account_trg
BEFORE INSERT OR UPDATE ON public.customer_accounts
FOR EACH ROW
EXECUTE FUNCTION public.validate_customer_account();

-- 2. customer_invitations
CREATE TABLE IF NOT EXISTS public.customer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  customer_account_id text NOT NULL,
  company_name text,
  tier text NOT NULL DEFAULT 'basic',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  can_see_trials boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by_user_id uuid,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_customer_invitations_code ON public.customer_invitations(code);

ALTER TABLE public.customer_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.customer_invitations;
CREATE POLICY "Admins can manage invitations"
  ON public.customer_invitations
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public read-by-code is handled via edge function (service role); no public RLS needed.

-- 3. container_credits_ledger
CREATE TABLE IF NOT EXISTS public.container_credits_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  container_id text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credits_ledger_customer ON public.container_credits_ledger(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_created_at ON public.container_credits_ledger(created_at DESC);

ALTER TABLE public.container_credits_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage credits ledger" ON public.container_credits_ledger;
CREATE POLICY "Admins can manage credits ledger"
  ON public.container_credits_ledger
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers can read own credits ledger" ON public.container_credits_ledger;
CREATE POLICY "Customers can read own credits ledger"
  ON public.container_credits_ledger
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_accounts ca
      WHERE ca.id = container_credits_ledger.customer_account_id
        AND ca.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Internal users can read credits ledger" ON public.container_credits_ledger;
CREATE POLICY "Internal users can read credits ledger"
  ON public.container_credits_ledger
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role));

-- 4. Live balance view
CREATE OR REPLACE VIEW public.customer_credit_balance AS
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

-- 5. Monthly grant function (called by cron)
CREATE OR REPLACE FUNCTION public.monthly_grant_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ca_record RECORD;
  grant_amount int;
  period_key text;
BEGIN
  period_key := to_char(now(), 'YYYY-MM') || '-monthly_grant';

  FOR ca_record IN
    SELECT id, tier FROM public.customer_accounts WHERE status = 'active'
  LOOP
    grant_amount := CASE ca_record.tier
      WHEN 'pro' THEN 4
      WHEN 'proPlus' THEN 10
      ELSE 0
    END;

    IF grant_amount > 0 THEN
      -- Skip if already granted this month
      IF NOT EXISTS (
        SELECT 1 FROM public.container_credits_ledger
        WHERE customer_account_id = ca_record.id
          AND reason = 'monthly_grant'
          AND note = period_key
      ) THEN
        INSERT INTO public.container_credits_ledger (customer_account_id, delta, reason, note)
        VALUES (ca_record.id, grant_amount, 'monthly_grant', period_key);
      END IF;
    END IF;
  END LOOP;
END;
$$;
