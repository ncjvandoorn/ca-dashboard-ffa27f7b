-- Shared pages: time-limited public snapshots of dashboard pages
CREATE TABLE public.shared_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_by UUID,
  created_by_username TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_pages_token ON public.shared_pages(token);
CREATE INDEX idx_shared_pages_expires_at ON public.shared_pages(expires_at);

ALTER TABLE public.shared_pages ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read a share link while it is still valid
CREATE POLICY "Public can read non-expired shared pages"
ON public.shared_pages
FOR SELECT
TO anon, authenticated
USING (expires_at > now());

-- Authenticated users can create share links (their own)
CREATE POLICY "Authenticated can create shared pages"
ON public.shared_pages
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Admins can delete share links
CREATE POLICY "Admins can delete shared pages"
ON public.shared_pages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));