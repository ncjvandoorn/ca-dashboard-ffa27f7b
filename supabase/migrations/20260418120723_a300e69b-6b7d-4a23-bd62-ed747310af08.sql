-- Tighten storage.objects access for the data-files bucket.
-- Goal: direct file reads via public URL keep working (Supabase serves them
-- via the storage API without checking RLS for public buckets when fetched
-- by URL), but anonymous SELECT against storage.objects (which is what
-- enables "list all files") is blocked.

-- Drop any existing broad SELECT policy that targets the data-files bucket.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%data-files%' OR with_check ILIKE '%data-files%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Only admins can list / read objects metadata for data-files via the API.
CREATE POLICY "Admins can list data-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'data-files' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can write (insert/update/delete) to the bucket.
CREATE POLICY "Admins can insert data-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'data-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data-files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'data-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'data-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'data-files' AND public.has_role(auth.uid(), 'admin'));