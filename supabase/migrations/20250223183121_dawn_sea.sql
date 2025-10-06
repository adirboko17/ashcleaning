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

-- Create policies
CREATE POLICY "Allow full access to authenticated users"
ON work_route_templates
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow full access to authenticated users"
ON work_route_assignments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

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