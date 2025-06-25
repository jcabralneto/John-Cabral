/*
  # Fix RLS policies for users table

  1. Security Functions
    - Create is_admin function for role checking
  
  2. RLS Policies
    - Drop existing conflicting policies
    - Create new policies for users table
    - Allow authenticated users to manage own profiles
    - Allow anonymous users to create profiles during signup
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

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow anonymous profile creation" ON users;

-- Create new RLS policies for users table
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow anonymous profile creation"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);