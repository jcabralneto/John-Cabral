/*
  # Fix User Profile RLS Policies

  1. Security Updates
    - Drop conflicting RLS policies on users table
    - Create simplified policies that allow proper profile management
    - Maintain admin access controls
    - Use correct auth.uid() function instead of uid()

  2. Policy Changes
    - Users can manage their own profiles (CRUD operations)
    - Admin can manage all profiles
    - Separate read policy for better performance
*/

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admin can update all profiles" ON users;
DROP POLICY IF EXISTS "Admin can delete profiles" ON users;
DROP POLICY IF EXISTS "Admin can read all profiles" ON users;

-- Create new policy that allows users to manage their own profile
CREATE POLICY "Users can manage own profile"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create admin policy that allows full access to all profiles
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

-- Create separate read policy for better performance
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);