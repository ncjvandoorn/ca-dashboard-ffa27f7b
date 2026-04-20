ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.customer_invitations ADD COLUMN IF NOT EXISTS username text;