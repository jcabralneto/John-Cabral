/*
  # Fix user table RLS policies

  1. Security Updates
    - Update RLS policies to allow proper user profile management
    - Allow users to upsert their own profiles
    - Maintain admin access controls

  2. Policy Changes
    - Add policy for users to upsert their own profiles
    - Ensure proper permissions for profile creation and updates
*/

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create new policies that allow proper profile management
CREATE POLICY "Users can manage own profile"
  ON users
  FOR ALL
  TO authenticated
  USING (uid() = id)
  WITH CHECK (uid() = id);

-- Ensure admin policy remains intact
DROP POLICY IF EXISTS "Admin can update all profiles" ON users;
DROP POLICY IF EXISTS "Admin can delete profiles" ON users;
DROP POLICY IF EXISTS "Admin can read all profiles" ON users;

CREATE POLICY "Admin can manage all profiles"
  ON users
  FOR ALL
  TO authenticated
  USING (
    (SELECT users.email FROM auth.users WHERE users.id = uid())::text = 'admin@gridspertise.com'::text
  )
  WITH CHECK (
    (SELECT users.email FROM auth.users WHERE users.id = uid())::text = 'admin@gridspertise.com'::text
  );

-- Keep the read policy for users to read their own profile
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (uid() = id);