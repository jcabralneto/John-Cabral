/*
  # Fix RLS policies for users table

  1. Security Changes
    - Drop conflicting policies that use uid() function
    - Create new policies using auth.uid() function
    - Ensure proper permissions for profile management
    - Allow anonymous users to create profiles during signup

  2. Policy Structure
    - Users can manage their own profiles
    - Admin has full access to all profiles
    - Anonymous users can create profiles during signup process
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users;
DROP POLICY IF EXISTS "Users can manage own profile" ON users;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON users;

-- Create comprehensive policy for authenticated users to manage their own profile
CREATE POLICY "Users can manage own profile"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure anonymous users can still create profiles during signup
CREATE POLICY "Allow profile creation during signup"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create admin policy for full access
CREATE POLICY "Admin full access"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@gridspertise.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@gridspertise.com'
    )
  );