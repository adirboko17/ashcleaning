/*
  # Final storage permissions fix
  
  1. Changes
    - Drop all existing policies
    - Create a single permissive policy for all operations
    - Enable public bucket access
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

-- Create a single, completely permissive policy for all operations
CREATE POLICY "storage_full_access"
ON storage.objects
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

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