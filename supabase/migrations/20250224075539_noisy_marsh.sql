-- Create function to validate stops JSON structure
CREATE OR REPLACE FUNCTION validate_stops_json()
RETURNS trigger AS $$
DECLARE
  stop jsonb;
BEGIN
  -- Check if stops is an array
  IF jsonb_typeof(NEW.stops) != 'array' THEN
    RAISE EXCEPTION 'stops must be a JSON array';
  END IF;

  -- Validate each stop in the array
  FOR stop IN SELECT value FROM jsonb_array_elements(NEW.stops)
  LOOP
    -- Check required fields and their types
    IF stop->>'client_id' IS NULL OR
       stop->>'branch_id' IS NULL OR
       stop->>'time' IS NULL OR
       jsonb_typeof(stop->'client') != 'object' OR
       jsonb_typeof(stop->'branch') != 'object' THEN
      RAISE EXCEPTION 'Invalid stop structure in stops array';
    END IF;

    -- Validate client object structure
    IF stop->'client'->>'id' IS NULL OR
       stop->'client'->>'full_name' IS NULL THEN
      RAISE EXCEPTION 'Invalid client object structure in stop';
    END IF;

    -- Validate branch object structure
    IF stop->'branch'->>'id' IS NULL OR
       stop->'branch'->>'name' IS NULL OR
       stop->'branch'->>'address' IS NULL THEN
      RAISE EXCEPTION 'Invalid branch object structure in stop';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update work_route_templates table
ALTER TABLE work_route_templates 
DROP COLUMN IF EXISTS stops;

ALTER TABLE work_route_templates
ADD COLUMN stops jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create trigger for validating stops
DROP TRIGGER IF EXISTS validate_stops_trigger ON work_route_templates;
CREATE TRIGGER validate_stops_trigger
  BEFORE INSERT OR UPDATE ON work_route_templates
  FOR EACH ROW
  EXECUTE FUNCTION validate_stops_json();

-- Add comment explaining the stops structure
COMMENT ON COLUMN work_route_templates.stops IS 
'Array of stops with structure:
{
  client_id: string,
  branch_id: string,
  time: string (HH:mm format),
  client: { id: string, full_name: string },
  branch: { id: string, name: string, address: string }
}';