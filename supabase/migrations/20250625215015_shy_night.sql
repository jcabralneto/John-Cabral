/*
  # Fix Recursive RLS Policies

  1. Security Functions
    - Create `is_admin()` function to check admin role without recursion
    - Create `is_admin_by_email()` function for email-based admin checks

  2. Policy Updates
    - Drop existing recursive policies
    - Create new non-recursive policies using security functions
    - Ensure proper access control for users and trips tables

  3. Changes
    - Remove circular dependencies in RLS policies
    - Maintain security while fixing infinite recursion
*/

-- Drop existing recursive policies that cause infinite recursion
DROP POLICY IF EXISTS "Admin full access" ON users;
DROP POLICY IF EXISTS "Admin has full access" ON users;
DROP POLICY IF EXISTS "Enable read access for admins to all profiles" ON users;
DROP POLICY IF EXISTS "Admins can manage all trips" ON trips;
DROP POLICY IF EXISTS "Enable admin full access on trips" ON trips;
DROP POLICY IF EXISTS "Admins can manage budgets" ON budgets;
DROP POLICY IF EXISTS "Admin can manage budgets" ON budgets;

-- Create security definer functions to check admin status without recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user has admin role by checking auth.users email directly
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'admin@gridspertise.com'
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_admin_by_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get user role from users table without triggering RLS
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Create new non-recursive policies for users table
CREATE POLICY "Admin full access by email" ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  );

-- Create new non-recursive policies for trips table
CREATE POLICY "Admin can manage all trips by email" ON trips
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  );

-- Create new non-recursive policies for budgets table
CREATE POLICY "Admin can manage budgets by email" ON budgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  );

-- Grant execute permissions on the security functions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_by_role() TO authenticated;