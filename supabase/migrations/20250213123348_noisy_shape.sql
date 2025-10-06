/*
  # Update database schema
  
  1. Changes
    - Remove full_name column
    - Keep only essential columns: id, phone_number, password, role, created_at
    - Update test data to match new schema
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
  TO public
  USING (true);

CREATE POLICY "Admins can manage users"
  ON users
  FOR ALL
  TO public
  USING (true);

-- Branches policies
CREATE POLICY "Users can view relevant branches"
  ON branches
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage branches"
  ON branches
  FOR ALL
  TO public
  USING (true);

-- Jobs policies
CREATE POLICY "Users can view relevant jobs"
  ON jobs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage jobs"
  ON jobs
  FOR ALL
  TO public
  USING (true);

CREATE POLICY "Employees can update their jobs"
  ON jobs
  FOR UPDATE
  TO public
  USING (true);

-- Insert initial test data
DO $$
DECLARE
  admin_id uuid;
  client_id uuid;
  employee_id uuid;
  branch_id uuid;
BEGIN
  -- Insert admin user
  INSERT INTO users (phone_number, password, role)
  VALUES ('0501234567', 'admin123', 'admin')
  RETURNING id INTO admin_id;

  -- Insert test client
  INSERT INTO users (phone_number, password, role)
  VALUES ('0502222222', 'client123', 'client')
  RETURNING id INTO client_id;

  -- Insert test employee
  INSERT INTO users (phone_number, password, role)
  VALUES ('0503333333', 'emp123', 'employee')
  RETURNING id INTO employee_id;

  -- Insert test branch
  INSERT INTO branches (name, address, client_id)
  VALUES ('סניף ראשי', 'רחוב הרצל 1, תל אביב', client_id)
  RETURNING id INTO branch_id;

  -- Insert test jobs
  INSERT INTO jobs (branch_id, employee_id, status, scheduled_date)
  VALUES 
    (branch_id, employee_id, 'pending', NOW() + interval '1 day'),
    (branch_id, employee_id, 'completed', NOW() - interval '1 day');
END $$;