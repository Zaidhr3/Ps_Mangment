/*
  # Combined Schema for PlayStation Management System

  1. Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `role` (text)
      - `created_at` (timestamp)
    
    - `devices`
      - `id` (uuid, primary key)
      - `name` (text)
      - `type` (enum: external, internal, vip)
      - `status` (enum: available, occupied, maintenance)
      - `hourly_rate` (numeric)
      - `extra_controller_rate` (numeric)
      - `location` (text)
    
    - `sessions`
      - `id` (uuid, primary key)
      - `device_id` (uuid, foreign key)
      - `start_time` (timestamp)
      - `end_time` (timestamp)
      - `extra_controllers` (integer)
      - `status` (enum: active, completed)
      - `total_cost` (numeric)
      - `discount_amount` (numeric)
      - `final_amount` (numeric)
      - `customer_name` (text)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Create trigger for new user registration
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS device_type CASCADE;
DROP TYPE IF EXISTS device_status CASCADE;
DROP TYPE IF EXISTS session_status CASCADE;

-- Create enums
CREATE TYPE device_type AS ENUM ('external', 'internal', 'vip');
CREATE TYPE device_status AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE session_status AS ENUM ('active', 'completed');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type device_type NOT NULL,
  status device_status NOT NULL DEFAULT 'available',
  hourly_rate numeric NOT NULL CHECK (hourly_rate >= 0),
  extra_controller_rate numeric NOT NULL DEFAULT 0,
  location text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  extra_controllers integer NOT NULL DEFAULT 0,
  status session_status NOT NULL DEFAULT 'active',
  total_cost numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL DEFAULT 0,
  customer_name text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_sessions_device_id ON sessions(device_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_devices_status ON devices(status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for users
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create policies for devices
CREATE POLICY "Enable all access for authenticated users on devices"
  ON devices
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for sessions
CREATE POLICY "Enable all access for authenticated users on sessions"
  ON sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert initial devices
INSERT INTO devices (name, type, hourly_rate, extra_controller_rate, location) VALUES
  ('جهاز خارجي 1', 'external', 1.5, 0.25, 'external'),
  ('جهاز خارجي 2', 'external', 1.5, 0.25, 'external'),
  ('جهاز خارجي 3', 'external', 1.5, 0.25, 'external'),
  ('جهاز خارجي 4', 'external', 1.5, 0.25, 'external'),
  ('جهاز خارجي 5', 'external', 1.5, 0.25, 'external'),
  ('جهاز خارجي 6', 'external', 1.5, 0.25, 'external'),
  ('جهاز خارجي 7', 'external', 1.5, 0.25, 'external'),
  ('جهاز خارجي 8', 'external', 1.5, 0.25, 'external'),
  ('جهاز داخلي', 'internal', 2, 0.25, 'internal'),
  ('جهاز VIP', 'vip', 3, 0, 'vip');

-- Create admin user if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'zaidalhrini114@gmail.com'
  ) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'zaidalhrini114@gmail.com',
      crypt('1234567', gen_salt('bf')),
      now(),
      NULL,
      '',
      NULL,
      '',
      NULL,
      '',
      '',
      NULL,
      NULL,
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      FALSE,
      now(),
      now(),
      NULL,
      NULL,
      '',
      '',
      NULL,
      '',
      0,
      NULL,
      '',
      NULL,
      FALSE,
      NULL
    );
  END IF;
END $$;

-- Set admin role for the user
INSERT INTO users (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'zaidalhrini114@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin';