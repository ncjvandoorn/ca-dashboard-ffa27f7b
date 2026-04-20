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
  IF NEW.tier NOT IN ('basic', 'pro', 'pro_plus', 'heavy') THEN
    RAISE EXCEPTION 'tier must be basic, pro, pro_plus or heavy';
  END IF;
  RETURN NEW;
END;
$$;

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
      WHEN 'pro_plus' THEN 10
      ELSE 0
    END;
    IF grant_amount > 0 THEN
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