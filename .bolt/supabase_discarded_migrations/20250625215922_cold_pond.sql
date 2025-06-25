/*
  # Fix RLS policies for users table

  1. Security Updates
    - Add missing INSERT policy for authenticated users to create their own profile
    - Add missing UPDATE policy for authenticated users to modify their own profile
    - Ensure proper RLS coverage for all CRUD operations

  2. Function Updates
    - Add is_admin() function if it doesn't exist
    - Ensure proper admin access patterns
*/

-- Create is_admin function if it doesn't exist
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND email = 'admin@gridspertise.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add missing RLS policies for users table
CREATE POLICY IF NOT EXISTS "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure anonymous users can create profiles during signup
CREATE POLICY IF NOT EXISTS "Allow anonymous profile creation"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);