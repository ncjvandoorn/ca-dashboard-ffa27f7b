-- Table to track hidden Sea Freight trips (admin-managed, visible to none)
CREATE TABLE public.sf_hidden_trips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id text NOT NULL UNIQUE,
  hidden_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sf_hidden_trips ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (so rows are hidden for all users)
CREATE POLICY "Anyone authenticated can read hidden trips"
ON public.sf_hidden_trips
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can hide trips"
ON public.sf_hidden_trips
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete (unhide)
CREATE POLICY "Admins can unhide trips"
ON public.sf_hidden_trips
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));