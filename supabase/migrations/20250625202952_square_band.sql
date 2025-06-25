/*
  # Fix Users Table RLS Policies

  1. Security Updates
    - Drop existing problematic policies
    - Create new simplified RLS policies for users table
    - Ensure proper access for authenticated users
    - Maintain admin privileges

  2. Policy Changes
    - Allow authenticated users to read all user profiles (for trip associations)
    - Allow users to manage their own profile
    - Allow admin to manage all users
    - Allow user creation during signup process
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Admin can manage all users" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create new policies with better permissions
CREATE POLICY "Allow authenticated users to read all profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to insert their own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow admin to manage all users"
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

-- Allow anonymous users to insert profiles during signup
CREATE POLICY "Allow profile creation during signup"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);