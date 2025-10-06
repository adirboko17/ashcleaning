/*
  # Add receipts storage bucket

  1. Storage
    - Create 'receipts' bucket for storing job completion receipts
  2. Security
    - Enable public read access to receipts
    - Allow authenticated users to upload receipts
*/

-- Create the receipts bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('receipts', 'receipts')
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view receipts
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Allow authenticated users to upload receipts
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Users can update own receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts' AND owner = auth.uid())
WITH CHECK (bucket_id = 'receipts' AND owner = auth.uid());

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts' AND owner = auth.uid());