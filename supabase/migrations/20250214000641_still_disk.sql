/*
  # Final storage configuration fix
  
  1. Changes
    - Remove all policies
    - Enable public access for the bucket
    - Set proper file size limits and MIME types
*/

-- First, drop all existing policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_access" ON storage.objects;
DROP POLICY IF EXISTS "public_select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage receipts" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_operations" ON storage.objects;
DROP POLICY IF EXISTS "allow_public_select" ON storage.objects;

-- Create a single, permissive policy for authenticated users
CREATE POLICY "allow_authenticated_operations"
ON storage.objects
AS PERMISSIVE
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create a policy for public access
CREATE POLICY "allow_public_select"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO public
USING (true);

-- Ensure the bucket exists with correct configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];