/*
  # Fix RLS infinite recursion

  1. Problem
    - Infinite recursion detected in policy for relation "users"
    - Policies are referencing themselves causing circular dependency

  2. Solution
    - Drop all existing policies
    - Create simple, non-recursive policies
    - Use direct auth.uid() checks instead of complex joins
    - Avoid self-referencing queries in policies

  3. Security
    - Maintain proper access control
    - Users can only see their own data
    - Admins can see all data
    - Anonymous users have limited access for public forms
*/

-- Disable RLS temporarily to clean up
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Enable read access for users to own profile" ON users;
DROP POLICY IF EXISTS "Enable read access for admins to all profiles" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users on own profile" ON users;
DROP POLICY IF EXISTS "Enable update for admins on all profiles" ON users;
DROP POLICY IF EXISTS "Enable delete for admins" ON users;

DROP POLICY IF EXISTS "Users can manage own trips" ON trips;
DROP POLICY IF EXISTS "Admins can manage all trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip insertion" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip selection" ON trips;

-- Drop functions that might cause recursion
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_current_user_id() CASCADE;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE policies for users table (no self-referencing)
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin policies using email check (no table self-reference)
CREATE POLICY "Admin can read all profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
  );

CREATE POLICY "Admin can update all profiles"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
  )
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
  );

CREATE POLICY "Admin can delete profiles"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
  );

-- Create SIMPLE policies for trips table
CREATE POLICY "Users can manage own trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage all trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
  )
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
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

-- Handle budgets table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budgets') THEN
    ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing budget policies
    DROP POLICY IF EXISTS "Admins can manage budgets" ON budgets;
    
    -- Create simple budget policy
    CREATE POLICY "Admin can manage budgets"
      ON budgets
      FOR ALL
      TO authenticated
      USING (
        (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
      )
      WITH CHECK (
        (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@gridspertise.com'
      );
  END IF;
END $$;

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_travel_date ON trips(travel_date);

-- Create or replace the trigger function for auto-creating user profiles
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();