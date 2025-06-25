/*
  # Fix RLS Policies - Final Solution

  1. Security Changes
    - Remove all conflicting RLS policies
    - Create simple, non-recursive policies
    - Use direct auth.users email check for admin access
    - Ensure proper user profile creation

  2. Policy Structure
    - Users can read/update their own profile
    - Admin (admin@gridspertise.com) can access all profiles
    - Users can manage their own trips
    - Admin can manage all trips
    - Anonymous users can insert trips (for public forms)

  3. Performance
    - Add proper indexes
    - Optimize policy queries
*/

-- Disable RLS temporarily for cleanup
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to ensure clean state
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on users table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON users';
    END LOOP;
    
    -- Drop all policies on trips table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'trips' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON trips';
    END LOOP;
END $$;

-- Drop any problematic functions
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_current_user_id() CASCADE;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE and EFFECTIVE policies for users table

-- Policy 1: Users can manage their own profile
CREATE POLICY "Users can manage own profile"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 2: Admin can manage all profiles (using direct email check)
CREATE POLICY "Admin can manage all profiles"
  ON users
  FOR ALL
  TO authenticated
  USING (
    (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text = 'admin@gridspertise.com'::text
  )
  WITH CHECK (
    (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text = 'admin@gridspertise.com'::text
  );

-- Policy 3: Separate read policy for better performance
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create SIMPLE and EFFECTIVE policies for trips table

-- Policy 1: Users can manage their own trips
CREATE POLICY "Users can manage own trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Admin can manage all trips
CREATE POLICY "Admin can manage all trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (
    (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text = 'admin@gridspertise.com'::text
  )
  WITH CHECK (
    (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text = 'admin@gridspertise.com'::text
  );

-- Policy 3: Allow anonymous users to insert trips (for public forms)
CREATE POLICY "Allow anonymous trip insertion"
  ON trips
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy 4: Allow anonymous users to read trips (for public viewing)
CREATE POLICY "Allow anonymous trip selection"
  ON trips
  FOR SELECT
  TO anon
  USING (true);

-- Handle budgets table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budgets' AND table_schema = 'public') THEN
    -- Enable RLS on budgets
    ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing budget policies
    DROP POLICY IF EXISTS "Admin can manage budgets" ON budgets;
    DROP POLICY IF EXISTS "Admins can manage budgets" ON budgets;
    
    -- Create budget policy for admin only
    CREATE POLICY "Admin can manage budgets"
      ON budgets
      FOR ALL
      TO authenticated
      USING (
        (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text = 'admin@gridspertise.com'::text
      )
      WITH CHECK (
        (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text = 'admin@gridspertise.com'::text
      );
  END IF;
END $$;

-- Ensure all necessary indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_not_null ON users(email) WHERE email IS NOT NULL;

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
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.trips TO authenticated, anon;

-- Grant sequence permissions if they exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'users_id_seq' AND sequence_schema = 'public') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'trips_id_seq' AND sequence_schema = 'public') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.trips_id_seq TO authenticated, anon;
  END IF;
END $$;