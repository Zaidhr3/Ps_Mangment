/*
  # Update Admin User with Specific UUID

  1. Changes
    - Update admin user with specific UUID
    - Ensure proper role assignment
*/

-- Update admin user with specific UUID
DO $$
DECLARE
  admin_id uuid := '3abb7e8e-5496-4774-8f22-dd8d7f94531c';
BEGIN
  -- First, ensure the user exists in auth.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = admin_id
  ) THEN
    -- Insert the admin user with the specific UUID
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      'zaidalhrini114@gmail.com',
      crypt('1234567', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now()
    );
  END IF;

  -- Ensure the user exists in public.users with admin role
  INSERT INTO public.users (id, email, role)
  VALUES (
    admin_id,
    'zaidalhrini114@gmail.com',
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin';
END $$;