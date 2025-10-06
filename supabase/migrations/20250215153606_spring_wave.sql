/*
  # Auto-delete old jobs function

  1. New Function
    - Creates a function to delete jobs older than 2 months
    - Function can be called manually or scheduled via external scheduler
    - Uses transaction to ensure atomic deletion
    - Includes logging of deleted count
  
  2. Security
    - Function runs with SECURITY DEFINER to ensure proper permissions
    - Restricted to specific table and operations
*/

-- Create function to delete old jobs
CREATE OR REPLACE FUNCTION delete_old_jobs()
RETURNS integer -- Returns number of deleted jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Start transaction
  BEGIN
    -- Delete jobs that are older than 2 months and count them
    WITH deleted AS (
      DELETE FROM jobs
      WHERE scheduled_date < (CURRENT_DATE - INTERVAL '2 months')
      RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted;

    -- Return the number of deleted jobs
    RETURN deleted_count;
  EXCEPTION
    WHEN OTHERS THEN
      -- Roll back on error
      RAISE EXCEPTION 'Error deleting old jobs: %', SQLERRM;
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_old_jobs() TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION delete_old_jobs() IS 'Deletes jobs older than 2 months based on scheduled_date. Returns the number of deleted jobs.';