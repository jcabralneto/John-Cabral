/*
  # Fix RLS policies for users table

  1. Security Updates
    - Add comprehensive RLS policy for upsert operations
    - Ensure authenticated users can manage their own profiles
    - Maintain admin privileges for all operations

  2. Changes
    - Add policy for authenticated users to upsert their own profile
    - Ensure proper permissions for profile creation and updates
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users;

-- Create comprehensive policy for authenticated users to manage their own profile
CREATE POLICY "Users can manage own profile"
  ON users
  FOR ALL
  TO authenticated
  USING (uid() = id)
  WITH CHECK (uid() = id);

-- Ensure anonymous users can still create profiles during signup
-- (This policy should already exist, but we'll recreate it to be safe)
DROP POLICY IF EXISTS "Allow profile creation during signup" ON users;
CREATE POLICY "Allow profile creation during signup"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);