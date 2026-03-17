
-- Create a public storage bucket for data files
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-files', 'data-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update files
CREATE POLICY "Authenticated users can upload data files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'data-files');

CREATE POLICY "Authenticated users can update data files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'data-files');

-- Allow anyone to read data files (needed for the app)
CREATE POLICY "Anyone can read data files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'data-files');
