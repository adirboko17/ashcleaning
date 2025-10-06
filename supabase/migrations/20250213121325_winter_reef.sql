/*
  # Fix Database Schema

  1. Changes
    - Drop existing tables to start fresh
    - Create users table with correct columns
    - Create branches table
    - Create jobs table
    - Set up RLS policies
    
  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each role
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  password text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'employee', 'client')),
  created_at timestamptz DEFAULT now()
);

-- Create branches table
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  client_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create jobs table
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed')),
  scheduled_date timestamptz NOT NULL,
  completed_date timestamptz,
  receipt_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Branches policies
CREATE POLICY "Users can view relevant branches"
  ON branches
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Admins can manage branches"
  ON branches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Jobs policies
CREATE POLICY "Users can view relevant jobs"
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
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Employees can update their jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
  )
  WITH CHECK (
    employee_id = auth.uid()
  );

-- Insert admin user for testing
INSERT INTO users (id, phone_number, password, name, role)
VALUES (
  gen_random_uuid(),
  '0501234567',
  'admin123',
  'מנהל מערכת',
  'admin'
);