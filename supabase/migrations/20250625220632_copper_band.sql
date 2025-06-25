/*
  # Fix RLS Policies and Admin Function

  This migration fixes all RLS policy issues by:
  1. Creating a non-recursive admin check function
  2. Properly configuring RLS policies for users and trips tables
  3. Ensuring proper permissions for all user types
  4. Fixing the admin dashboard access issues

  ## Changes Made
  - Drop all existing conflicting policies
  - Create secure admin check function without recursion
  - Add comprehensive RLS policies for users table
  - Add comprehensive RLS policies for trips table
  - Ensure anonymous access where needed
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admin can manage budgets by email" ON budgets;
DROP POLICY IF EXISTS "Admin can manage all trips by email" ON trips;
DROP POLICY IF EXISTS "Admins can manage all trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip insertion" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip selection" ON trips;
DROP POLICY IF EXISTS "Users can manage own trips" ON trips;

DROP POLICY IF EXISTS "Admins can delete profiles" ON users;
DROP POLICY IF EXISTS "Admins can update any profile" ON users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
DROP POLICY IF EXISTS "Allow anonymous profile creation" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Drop existing functions
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS user_exists();

-- Create a simple admin check function that uses auth.users directly
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'admin@gridspertise.com'
  );
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- RLS Policies for users table
-- Allow anyone to insert profiles (needed for signup)
CREATE POLICY "Enable insert for all users" ON users
  FOR INSERT
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

-- Allow anonymous users to insert trips (for public forms if needed)
CREATE POLICY "Allow anonymous trip insertion" ON trips
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to select trips (for public viewing if needed)
CREATE POLICY "Allow anonymous trip selection" ON trips
  FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for budgets table (admin only)
CREATE POLICY "Admin can manage budgets" ON budgets
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Ensure RLS is enabled on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;