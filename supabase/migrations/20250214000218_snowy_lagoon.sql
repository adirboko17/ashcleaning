/*
  # Fix storage policies for receipts

  1. Changes
    - Drop existing policies
    - Create comprehensive policies for storage access
    - Update bucket configuration
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;

-- Create policy for public viewing
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Create policy for authenticated users to upload files
CREATE POLICY "Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Create policy for authenticated users to update files
CREATE POLICY "Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- Create policy for authenticated users to delete files
CREATE POLICY "Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- Make sure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('receipts', 'receipts', true, 52428800)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 52428800;