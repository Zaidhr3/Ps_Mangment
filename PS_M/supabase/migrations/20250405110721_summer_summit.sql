/*
  # Add Additional Policies and Indexes

  1. Changes
    - Add additional indexes for performance
    - Add missing policies for better security
    - Add cascade rules for data integrity
*/

-- Add additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_name);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Add missing cascade rules
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_device_id_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_device_id_fkey 
  FOREIGN KEY (device_id) 
  REFERENCES devices(id) 
  ON DELETE CASCADE;

-- Add additional policies for users
CREATE POLICY IF NOT EXISTS "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY IF NOT EXISTS "Admins can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Add additional policies for devices
CREATE POLICY IF NOT EXISTS "Admins can manage devices"
  ON devices
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Add additional policies for sessions
CREATE POLICY IF NOT EXISTS "Users can only view active sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY IF NOT EXISTS "Admins can view all sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Add function to automatically update device status when session changes
CREATE OR REPLACE FUNCTION update_device_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE devices SET status = 'occupied' WHERE id = NEW.device_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' THEN
    UPDATE devices SET status = 'available' WHERE id = NEW.device_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for device status updates
DROP TRIGGER IF EXISTS update_device_status_trigger ON sessions;
CREATE TRIGGER update_device_status_trigger
  AFTER INSERT OR UPDATE OF status
  ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_device_status();