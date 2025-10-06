-- Remove employee_id column from work_route_templates
ALTER TABLE work_route_templates DROP COLUMN IF EXISTS employee_id;

-- Update validation function to include employee validation
CREATE OR REPLACE FUNCTION validate_template_stops()
RETURNS trigger AS $$
DECLARE
  stop record;
BEGIN
  -- Check if stops is an array
  IF jsonb_typeof(NEW.stops) != 'array' THEN
    RAISE EXCEPTION 'stops must be a JSON array';
  END IF;

  -- Validate each stop in the array
  FOR stop IN 
    SELECT value FROM jsonb_array_elements(NEW.stops)
  LOOP
    IF stop.value->>'client_id' IS NULL OR
       stop.value->>'branch_id' IS NULL OR
       stop.value->>'employee_id' IS NULL OR
       stop.value->>'time' IS NULL OR
       jsonb_typeof(stop.value->'client') != 'object' OR
       jsonb_typeof(stop.value->'branch') != 'object' OR
       jsonb_typeof(stop.value->'employee') != 'object' OR
       stop.value->'client'->>'id' IS NULL OR
       stop.value->'client'->>'full_name' IS NULL OR
       stop.value->'branch'->>'id' IS NULL OR
       stop.value->'branch'->>'name' IS NULL OR
       stop.value->'branch'->>'address' IS NULL OR
       stop.value->'employee'->>'id' IS NULL OR
       stop.value->'employee'->>'full_name' IS NULL THEN
      RAISE EXCEPTION 'Invalid stop structure in stops array';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old index
DROP INDEX IF EXISTS work_route_templates_employee_id_idx;

-- Update comment explaining the stops structure
COMMENT ON COLUMN work_route_templates.stops IS 
'Array of stops with structure:
{
  client_id: string,
  branch_id: string,
  employee_id: string,
  time: string (HH:mm format),
  client: { id: string, full_name: string },
  branch: { id: string, name: string, address: string },
  employee: { id: string, full_name: string }
}';