/*
  # Initial Schema Setup for Cleaning Management System

  1. Tables
    - users
      - id (uuid, primary key)
      - phone (text, unique)
      - password_hash (text)
      - role (text)
      - name (text)
      - created_at (timestamptz)
    
    - branches
      - id (uuid, primary key)
      - name (text)
      - address (text)
      - client_id (uuid, foreign key)
      - created_at (timestamptz)
    
    - jobs
      - id (uuid, primary key)
      - branch_id (uuid, foreign key)
      - employee_id (uuid, foreign key)
      - status (text)
      - scheduled_date (timestamptz)
      - completed_date (timestamptz)
      - receipt_url (text)
      - created_at (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
*/

-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'employee', 'client')),
  name text NOT NULL,
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
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage all users"
  ON users
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Branches policies
CREATE POLICY "Clients can read their own branches"
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
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Jobs policies
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