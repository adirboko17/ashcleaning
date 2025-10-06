/*
  # Add receipts storage bucket

  1. Storage Policies
    - Creates policies to manage access to receipt images
    - Allows authenticated users to upload receipts
    - Allows public access to view receipts
*/

-- Create policies for storage access
CREATE POLICY "Allow authenticated users to upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  (storage.foldername(name))[1] != 'private'
);

CREATE POLICY "Allow public to view receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');