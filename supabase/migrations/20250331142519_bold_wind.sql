/*
  # Fix delete_old_jobs function
  
  1. Changes
    - Modify function to preserve future jobs
    - Only delete completed jobs older than 2 months
    - Add additional safety checks
*/

CREATE OR REPLACE FUNCTION delete_old_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Start transaction
  BEGIN
    -- Delete only completed jobs that are older than 2 months
    -- AND ensure we never delete future jobs
    WITH deleted AS (
      DELETE FROM jobs
      WHERE status = 'completed'
        AND scheduled_date < CURRENT_DATE - INTERVAL '2 months'
        AND scheduled_date < CURRENT_DATE
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
COMMENT ON FUNCTION delete_old_jobs() IS 'Deletes completed jobs older than 2 months, preserving all future jobs and pending jobs. Returns the number of deleted jobs.';