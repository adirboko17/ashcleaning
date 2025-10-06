-- Create work route assignments table
CREATE TABLE IF NOT EXISTS work_route_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  template_index integer NOT NULL,
  employee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (date, employee_id)
);

-- Enable RLS
ALTER TABLE work_route_assignments ENABLE ROW LEVEL SECURITY;

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

-- Add indexes for better performance
CREATE INDEX work_route_assignments_date_idx ON work_route_assignments(date);
CREATE INDEX work_route_assignments_employee_id_idx ON work_route_assignments(employee_id);