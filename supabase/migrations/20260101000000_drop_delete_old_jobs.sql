/*
  # Drop delete_old_jobs function

  This migration removes the `public.delete_old_jobs()` function from the database.
*/

DROP FUNCTION IF EXISTS public.delete_old_jobs();

