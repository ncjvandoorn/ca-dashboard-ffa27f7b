
-- Table to store full AI conversations (question + answer pairs)
CREATE TABLE public.ai_conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  user_email text,
  username text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert conversation logs" ON public.ai_conversation_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read conversation logs" ON public.ai_conversation_logs FOR SELECT TO authenticated USING (true);

-- Table to store AI-generated learnings (editable by admin)
CREATE TABLE public.ai_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learnings text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai learnings" ON public.ai_learnings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert ai learnings" ON public.ai_learnings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update ai learnings" ON public.ai_learnings FOR UPDATE TO authenticated USING (true);
