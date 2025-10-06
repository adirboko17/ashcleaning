-- Drop existing tables and their policies
DROP TABLE IF EXISTS work_route_assignments CASCADE;
DROP TABLE IF EXISTS work_route_templates CASCADE;

-- Create work route templates table
CREATE TABLE work_route_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  employee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  stops jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create work route assignments table
CREATE TABLE work_route_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  template_index integer NOT NULL,
  employee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (date, employee_id)
);

-- Enable RLS
ALTER TABLE work_route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_route_assignments ENABLE ROW LEVEL SECURITY;

-- Create public policies for templates
CREATE POLICY "Public read access to templates"
ON work_route_templates
FOR SELECT
TO public
USING (true);

CREATE POLICY "Public write access to templates"
ON work_route_templates
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Public update access to templates"
ON work_route_templates
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Public delete access to templates"
ON work_route_templates
FOR DELETE
TO public
USING (true);

-- Create public policies for assignments
CREATE POLICY "Public read access to assignments"
ON work_route_assignments
FOR SELECT
TO public
USING (true);

CREATE POLICY "Public write access to assignments"
ON work_route_assignments
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Public update access to assignments"
ON work_route_assignments
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Public delete access to assignments"
ON work_route_assignments
FOR DELETE
TO public
USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_work_route_templates_updated_at
  BEFORE UPDATE
  ON work_route_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();