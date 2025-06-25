/*
  # Fix RLS Policies and Database Schema Issues

  1. Database Schema Fixes
    - Create security definer function to prevent RLS recursion
    - Fix RLS policies for users table
    - Ensure proper table structure alignment

  2. Security Updates
    - Remove recursive RLS policies
    - Add proper admin check function
    - Update policies to use security definer function

  3. Data Integrity
    - Ensure all tables have proper constraints
    - Add missing indexes for performance
*/

-- Create a SECURITY DEFINER function to check admin status without RLS recursion
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

-- Create a SECURITY DEFINER function to get user ID safely
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN auth.uid();
END;
$$;

-- Drop existing problematic policies on users table
DROP POLICY IF EXISTS "Allow admin user management" ON users;
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new, non-recursive policies for users table
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (get_current_user_id() = id);

CREATE POLICY "Admins can read all profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_admin(get_current_user_id()));

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (get_current_user_id() = id)
  WITH CHECK (get_current_user_id() = id);

CREATE POLICY "Admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (is_admin(get_current_user_id()))
  WITH CHECK (is_admin(get_current_user_id()));

-- Fix trips table policies to use the new functions
DROP POLICY IF EXISTS "Allow authenticated users to view their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to update their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own trips" ON trips;

CREATE POLICY "Users can manage own trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

CREATE POLICY "Admins can manage all trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (is_admin(get_current_user_id()))
  WITH CHECK (is_admin(get_current_user_id()));

-- Allow anonymous users to insert trips (for public forms)
CREATE POLICY "Allow anonymous trip insertion"
  ON trips
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to select trips (for public viewing)
CREATE POLICY "Allow anonymous trip selection"
  ON trips
  FOR SELECT
  TO anon
  USING (true);

-- Ensure budgets table has proper RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budgets"
  ON budgets
  FOR ALL
  TO authenticated
  USING (is_admin(get_current_user_id()))
  WITH CHECK (is_admin(get_current_user_id()));

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_travel_date ON trips(travel_date);
CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(year, month);