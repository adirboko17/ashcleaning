/*
  # Fix storage policies for receipts

  1. Changes
    - Drop existing policies
    - Create comprehensive policies for storage access
    - Update bucket configuration
    - Add owner-based policies
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage receipts" ON storage.objects;

-- Create policy for public viewing
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Create policy for authenticated users to upload files
CREATE POLICY "Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Create policy for authenticated users to update files
CREATE POLICY "Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
)
WITH CHECK (
  bucket_id = 'receipts' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Create policy for authenticated users to delete files
CREATE POLICY "Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Make sure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];