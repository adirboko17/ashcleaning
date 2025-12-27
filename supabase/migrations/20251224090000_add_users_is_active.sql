/*
  # Add is_active to users

  Admin can deactivate employees who left.
  Default: all existing + new users are active unless explicitly set otherwise.
*/

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill (safe even with default, kept explicit for clarity)
UPDATE public.users
SET is_active = true
WHERE is_active IS NULL;




