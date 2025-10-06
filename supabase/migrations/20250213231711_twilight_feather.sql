/*
  # Add work routes management

  1. New Tables
    - `work_routes`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, references users)
      - `week_number` (int, 1-4)
      - `created_at` (timestamp)
      
    - `work_route_stops`
      - `id` (uuid, primary key)
      - `route_id` (uuid, references work_routes)
      - `branch_id` (uuid, references branches)
      - `day_of_week` (int, 0-6)
      - `time` (time)
      - `order` (int)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for admin access
*/

-- Create work_routes table
CREATE TABLE work_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  week_number int NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  created_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, week_number)
);

-- Create work_route_stops table
CREATE TABLE work_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES work_routes(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time time NOT NULL,
  "order" int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE work_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_route_stops ENABLE ROW LEVEL SECURITY;

-- Work routes policies
CREATE POLICY "Admins can manage work routes"
  ON work_routes
  FOR ALL
  TO public
  USING (true);

-- Work route stops policies
CREATE POLICY "Admins can manage work route stops"
  ON work_route_stops
  FOR ALL
  TO public
  USING (true);

-- Create indexes
CREATE INDEX work_routes_employee_id_idx ON work_routes(employee_id);
CREATE INDEX work_route_stops_route_id_idx ON work_route_stops(route_id);
CREATE INDEX work_route_stops_branch_id_idx ON work_route_stops(branch_id);