/*
  # Add full_name column to users table

  1. Changes
    - Add `full_name` column to `users` table
    - Update existing users with default names
*/

-- Add full_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE users ADD COLUMN full_name text;
    
    -- Update existing users with their phone numbers as names temporarily
    UPDATE users SET full_name = phone_number;
    
    -- Make the column required
    ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
  END IF;
END $$;