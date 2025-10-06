/*
  # Update users table and jobs schema

  1. Changes
    - Rename users.phone column to phone_number
    - Add jobs table for tracking cleaning tasks
  
  2. Security
    - Enable RLS on jobs table
    - Add policies for job access control
*/

-- Update users table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users RENAME COLUMN phone TO phone_number;
  END IF;
END $$;

-- Create jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed')),
  scheduled_date timestamptz NOT NULL,
  completed_date timestamptz,
  receipt_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'jobs' AND rowsecurity = true
  ) THEN
    ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read relevant jobs" ON jobs;
  DROP POLICY IF EXISTS "Admins can manage jobs" ON jobs;
  DROP POLICY IF EXISTS "Employees can update assigned jobs" ON jobs;
END $$;

-- Create new policies
CREATE POLICY "Users can read relevant jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'admin' OR
        (users.role = 'employee' AND jobs.employee_id = users.id) OR
        (users.role = 'client' AND EXISTS (
          SELECT 1 FROM branches
          WHERE branches.id = jobs.branch_id
          AND branches.client_id = users.id
        ))
      )
    )
  );

CREATE POLICY "Admins can manage jobs"
  ON jobs
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Employees can update assigned jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
  )
  WITH CHECK (
    employee_id = auth.uid()
  );