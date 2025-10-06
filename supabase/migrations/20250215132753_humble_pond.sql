/*
  # Add is_recurring column to work_route_stops table

  1. Changes
    - Add is_recurring boolean column to work_route_stops table with default value false
*/

-- Add is_recurring column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_route_stops' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE work_route_stops ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;
END $$;