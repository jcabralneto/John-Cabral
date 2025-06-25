/*
  # Fix RLS policies for users and trips tables

  1. Security Updates
    - Add missing UPDATE policy for users table
    - Add missing INSERT policy for users table  
    - Fix admin policies to properly reference the users table
    - Ensure all CRUD operations are covered with proper policies

  2. Policy Changes
    - Users can insert their own profile during registration
    - Users can update their own profile data
    - Admin users can perform all operations on users table
    - Fix trips table admin policy to reference correct table
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Admin can manage all profiles" ON users;
DROP POLICY IF EXISTS "Users can manage own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admin can manage all trips" ON trips;
DROP POLICY IF EXISTS "Users can manage own trips" ON trips;

-- Users table policies
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

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

CREATE POLICY "Admin can manage all users"
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

-- Trips table policies (fix admin policy)
CREATE POLICY "Users can manage own trips"
  ON trips
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage all trips"
  ON trips
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