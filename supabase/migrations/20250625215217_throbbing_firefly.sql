/*
  # Fix RLS policies to resolve infinite recursion

  1. Security Functions
    - Create `is_admin()` function to safely check admin status
    - Use SECURITY INVOKER to avoid privilege escalation

  2. Updated RLS Policies
    - Remove recursive policies that cause infinite loops
    - Use the new admin function for clean admin checks
    - Ensure proper access control for users and trips tables

  3. Policy Structure
    - Users can manage their own data
    - Admins can manage all data
    - Anonymous users can insert profiles during signup
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admin full access by email" ON users;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON users;
DROP POLICY IF EXISTS "Enable delete for admins" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable read access for users to own profile" ON users;
DROP POLICY IF EXISTS "Enable update for users on own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can manage own profile" ON users;
DROP POLICY IF EXISTS "Users can read all profiles" ON users;

DROP POLICY IF EXISTS "Admin can manage all trips by email" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip insertion" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip selection" ON trips;
DROP POLICY IF EXISTS "Enable delete for users on own trips" ON trips;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON trips;
DROP POLICY IF EXISTS "Enable read for users on own trips" ON trips;
DROP POLICY IF EXISTS "Enable update for users on own trips" ON trips;
DROP POLICY IF EXISTS "Users can manage own trips" ON trips;

-- Create admin check function that doesn't cause recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get email from auth.users directly to avoid recursion
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  -- Check if user is admin by email
  RETURN user_email = 'admin@gridspertise.com';
END;
$$;

-- Create function to check if user exists in users table
CREATE OR REPLACE FUNCTION public.user_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid());
END;
$$;

-- RLS Policies for users table
-- Allow anonymous users to insert profiles during signup
CREATE POLICY "Allow anonymous profile creation" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile" ON users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- RLS Policies for trips table
-- Users can manage their own trips
CREATE POLICY "Users can manage own trips" ON trips
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all trips
CREATE POLICY "Admins can manage all trips" ON trips
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Allow anonymous users to insert trips (for public forms)
CREATE POLICY "Allow anonymous trip insertion" ON trips
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to select trips (for public viewing)
CREATE POLICY "Allow anonymous trip selection" ON trips
  FOR SELECT
  TO anon
  USING (true);