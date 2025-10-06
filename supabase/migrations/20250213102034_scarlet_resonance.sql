/*
  # הגדרת סכמת אימות משתמשים

  1. טבלאות חדשות
    - `auth.users` - טבלת משתמשים מובנית של Supabase Auth
    - `public.users` - טבלת פרופילי משתמשים מותאמת אישית
      - `id` (uuid, מפתח ראשי)
      - `phone` (טקסט, ייחודי)
      - `role` (enum: admin/employee/client)
      - `name` (טקסט)
      - `created_at` (timestamp)

  2. אבטחה
    - הפעלת RLS על טבלת המשתמשים
    - הגדרת מדיניות גישה למשתמשים מאומתים
*/

-- הגדרת סוגי תפקידים
CREATE TYPE user_role AS ENUM ('admin', 'employee', 'client');

-- יצירת טבלת משתמשים
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  role user_role NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- הפעלת RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- מדיניות גישה למשתמשים מאומתים
CREATE POLICY "משתמשים יכולים לקרוא את הנתונים שלהם"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- מדיניות גישה למנהלים
CREATE POLICY "מנהלים יכולים לנהל את כל המשתמשים"
  ON public.users
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- פונקציה ליצירת משתמש חדש
CREATE OR REPLACE FUNCTION public.create_new_user(
  phone_number text,
  user_password text,
  user_role user_role,
  user_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- יצירת משתמש חדש ב-auth.users
  INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
  VALUES (
    phone_number,
    crypt(user_password, gen_salt('bf')),
    jsonb_build_object('phone', phone_number)
  )
  RETURNING id INTO new_user_id;

  -- יצירת פרופיל משתמש
  INSERT INTO public.users (id, phone, role, name)
  VALUES (new_user_id, phone_number, user_role, user_name);

  RETURN new_user_id;
END;
$$;