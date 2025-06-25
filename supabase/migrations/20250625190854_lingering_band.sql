/*
  # Fix User Profile Loading Issues

  1. Security
    - Fix infinite recursion in RLS policies
    - Simplify admin check functions
    - Ensure proper user access controls

  2. Changes
    - Drop all dependent policies first
    - Recreate functions without recursion
    - Add new simplified policies
    - Maintain security while fixing performance
*/

-- First, drop all policies that depend on functions
-- Users table policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Allow admin user management" ON users;
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Trips table policies
DROP POLICY IF EXISTS "Users can manage own trips" ON trips;
DROP POLICY IF EXISTS "Admins can manage all trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip insertion" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip selection" ON trips;
DROP POLICY IF EXISTS "Allow anonymous users to insert trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous users to select trips" ON trips;

-- Budgets table policies (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budgets') THEN
    DROP POLICY IF EXISTS "Admins can manage budgets" ON budgets;
  END IF;
END $$;

-- Now drop the functions
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_current_user_id() CASCADE;

-- Create a simple function to get current user ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid();
$$;

-- Create admin check function that avoids recursion by using a direct query
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- Direct query to avoid recursion
  SELECT role INTO user_role 
  FROM public.users 
  WHERE id = user_id;
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Ensure RLS is enabled on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Create new, simple policies for users table
CREATE POLICY "Enable read access for users to own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Enable read access for admins to all profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    -- Direct role check to avoid function recursion
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.users u ON au.id = u.id
      WHERE au.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Enable insert for authenticated users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users on own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for admins on all profiles"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.users u ON au.id = u.id
      WHERE au.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.users u ON au.id = u.id
      WHERE au.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Enable delete for admins"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.users u ON au.id = u.id
      WHERE au.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Create simple trip policies
CREATE POLICY "Users can manage own trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.users u ON au.id = u.id
      WHERE au.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.users u ON au.id = u.id
      WHERE au.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Allow anonymous access for public forms
CREATE POLICY "Allow anonymous trip insertion"
  ON trips
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous trip selection"
  ON trips
  FOR SELECT
  TO anon
  USING (true);

-- Add budgets policies if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budgets') THEN
    ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
    
    -- Create budget policy
    CREATE POLICY "Admins can manage budgets"
      ON budgets
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM auth.users au
          JOIN public.users u ON au.id = u.id
          WHERE au.id = auth.uid() AND u.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM auth.users au
          JOIN public.users u ON au.id = u.id
          WHERE au.id = auth.uid() AND u.role = 'admin'
        )
      );
  END IF;
END $$;

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(lower(name));

-- Add unique constraint for email when not null
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_not_null 
ON users(email) WHERE email IS NOT NULL;

-- Ensure trips indexes
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_travel_date ON trips(travel_date);

-- Create trigger function to auto-create user profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE 
      WHEN NEW.email = 'admin@gridspertise.com' THEN 'admin'
      ELSE 'regular'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();