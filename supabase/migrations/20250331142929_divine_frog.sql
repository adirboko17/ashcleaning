/*
  # Update delete_old_jobs function
  
  1. Changes
    - Delete completed jobs after 2 months
    - Delete pending jobs after 3 months
    - Add safety checks for future jobs
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
    -- Delete jobs based on their status and age
    WITH deleted AS (
      DELETE FROM jobs
      WHERE (
        -- Delete completed jobs older than 2 months
        (status = 'completed' AND scheduled_date < CURRENT_DATE - INTERVAL '2 months')
        OR
        -- Delete pending jobs older than 3 months
        (status = 'pending' AND scheduled_date < CURRENT_DATE - INTERVAL '3 months')
      )
      -- Additional safety check to never delete future jobs
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
COMMENT ON FUNCTION delete_old_jobs() IS 'Deletes completed jobs older than 2 months and pending jobs older than 3 months. Preserves all future jobs. Returns the number of deleted jobs.';