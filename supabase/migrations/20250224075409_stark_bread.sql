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
    IF jsonb_typeof(stop->>'client_id') != 'string' OR
       jsonb_typeof(stop->>'branch_id') != 'string' OR
       jsonb_typeof(stop->>'time') != 'string' OR
       jsonb_typeof(stop->'client') != 'object' OR
       jsonb_typeof(stop->'branch') != 'object' THEN
      RAISE EXCEPTION 'Invalid stop structure in stops array';
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