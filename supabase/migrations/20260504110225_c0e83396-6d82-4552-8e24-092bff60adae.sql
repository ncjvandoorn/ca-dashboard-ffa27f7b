ALTER TABLE public.user_expertise
ADD COLUMN IF NOT EXISTS farm_scope text NOT NULL DEFAULT 'responsible';

ALTER TABLE public.user_expertise
DROP CONSTRAINT IF EXISTS user_expertise_farm_scope_check;

ALTER TABLE public.user_expertise
ADD CONSTRAINT user_expertise_farm_scope_check
CHECK (farm_scope IN ('responsible', 'all'));