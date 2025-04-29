/*
  # Reset Schema and Data

  1. Changes
    - Drop all existing tables and types
    - Recreate schema with original structure
    - Add initial devices
    - Create admin user
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

-- Create admin user
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
  '3abb7e8e-5496-4774-8f22-dd8d7f94531c',
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
) ON CONFLICT (id) DO UPDATE
SET encrypted_password = crypt('1234567', gen_salt('bf'));

-- Set admin role for the user
INSERT INTO users (id, email, role)
VALUES (
  '3abb7e8e-5496-4774-8f22-dd8d7f94531c',
  'zaidalhrini114@gmail.com',
  'admin'
) ON CONFLICT (id) DO UPDATE
SET role = 'admin';