/*
  # Create core database schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `email` (text, unique when not null)
      - `role` (text, default 'regular')
      - `created_at` (timestamp)
    - `trips`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `travel_date` (date, required)
      - `destination_country` (text, required)
      - `destination_city` (text, required)
      - `cost_tickets` (numeric, required)
      - `cost_lodging` (numeric, required)
      - `cost_daily_allowances` (numeric, required)
      - `cost_center` (text, required)
      - `trip_type` (text, check constraint)
      - `trip_reason` (text, check constraint)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for user access and admin access
    - Create admin user and sample data

  3. Indexes
    - Performance indexes for common queries
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (main table)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'regular' CHECK (role IN ('admin', 'regular')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for email (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'users_email_unique_not_null'
    ) THEN
        CREATE UNIQUE INDEX users_email_unique_not_null ON users (email) WHERE email IS NOT NULL;
    END IF;
END $$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_name ON users (name);
CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users (lower(name));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_email_auth ON users (email);

-- Create trips table (main table)
CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    travel_date DATE NOT NULL,
    destination_country TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    cost_tickets NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_lodging NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_daily_allowances NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_center TEXT NOT NULL DEFAULT 'Não informado',
    trip_type TEXT NOT NULL CHECK (trip_type IN ('Nacional', 'Continental', 'Intercontinental')),
    trip_reason TEXT CHECK (trip_reason IS NULL OR trip_reason IN ('JOBI-M', 'LVM', 'SERVIÇOS', 'INDIRETO', 'CHILE', 'COLOMBIA', 'SALES', 'OUTROS')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add performance indexes for trips
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips (user_id);
CREATE INDEX IF NOT EXISTS idx_trips_travel_date ON trips (travel_date);
CREATE INDEX IF NOT EXISTS idx_trips_reason ON trips (trip_reason);

-- Insert default admin user (check if it already exists first)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@gridspertise.com') THEN
        INSERT INTO users (name, email, role) VALUES 
            ('Administrador', 'admin@gridspertise.com', 'admin');
    END IF;
END $$;

-- Insert sample users (check if they already exist first)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'joao@gridspertise.com') THEN
        INSERT INTO users (name, email, role) VALUES 
            ('João Silva', 'joao@gridspertise.com', 'regular');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'maria@gridspertise.com') THEN
        INSERT INTO users (name, email, role) VALUES 
            ('Maria Santos', 'maria@gridspertise.com', 'regular');
    END IF;
END $$;

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Remove existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Allow admin user management" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to view their own trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous users to insert trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to update their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous users to select trips" ON trips;
DROP POLICY IF EXISTS "Admin full access by email" ON users;
DROP POLICY IF EXISTS "Admin can manage all trips by email" ON trips;
DROP POLICY IF EXISTS "Users can manage own profile" ON users;
DROP POLICY IF EXISTS "Users can manage own trips" ON trips;
DROP POLICY IF EXISTS "Enable read for users on own trips" ON trips;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON trips;
DROP POLICY IF EXISTS "Enable update for users on own trips" ON trips;
DROP POLICY IF EXISTS "Enable delete for users on own trips" ON trips;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON users;
DROP POLICY IF EXISTS "Enable read access for users to own profile" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users on own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read all profiles" ON users;
DROP POLICY IF EXISTS "Enable delete for admins" ON users;

-- Policies for users table
CREATE POLICY "Allow profile creation during signup" ON users
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users" ON users
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable read access for users to own profile" ON users
    FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Enable update for users on own profile" ON users
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own profile" ON users
    FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read all profiles" ON users
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable delete for admins" ON users
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users u2 
            WHERE u2.id = auth.uid() AND u2.role = 'admin'
        )
    );

CREATE POLICY "Admin full access by email" ON users
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND email = 'admin@gridspertise.com'
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND email = 'admin@gridspertise.com'
        )
    );

-- Policies for trips table
CREATE POLICY "Allow anonymous trip selection" ON trips
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous trip insertion" ON trips
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Enable read for users on own trips" ON trips
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users" ON trips
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users on own trips" ON trips
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete for users on own trips" ON trips
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own trips" ON trips
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage all trips by email" ON trips
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND email = 'admin@gridspertise.com'
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND email = 'admin@gridspertise.com'
        )
    );

-- Insert sample trips
DO $$
DECLARE
    admin_id UUID;
    user1_id UUID;
    user2_id UUID;
BEGIN
    -- Get user IDs
    SELECT id INTO admin_id FROM users WHERE email = 'admin@gridspertise.com';
    SELECT id INTO user1_id FROM users WHERE email = 'joao@gridspertise.com';
    SELECT id INTO user2_id FROM users WHERE email = 'maria@gridspertise.com';
    
    -- Insert trips only if users exist and trips don't exist
    IF admin_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = admin_id AND destination_city = 'São Paulo'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type, trip_reason) 
        VALUES (admin_id, '2024-01-15', 'Brasil', 'São Paulo', 800.00, 300.00, 200.00, 'JOBI-M', 'Nacional', 'JOBI-M');
    END IF;
    
    IF user1_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = user1_id AND destination_city = 'Buenos Aires'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type, trip_reason) 
        VALUES (user1_id, '2024-02-20', 'Argentina', 'Buenos Aires', 1200.00, 800.00, 400.00, 'SALES', 'Continental', 'SALES');
    END IF;
    
    IF user2_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = user2_id AND destination_city = 'Paris'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type, trip_reason) 
        VALUES (user2_id, '2024-03-10', 'França', 'Paris', 3500.00, 2000.00, 1000.00, 'LVM', 'Intercontinental', 'LVM');
    END IF;
    
    -- Add more sample trips for better testing
    IF admin_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = admin_id AND destination_city = 'Rio de Janeiro'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type, trip_reason) 
        VALUES (admin_id, '2024-04-05', 'Brasil', 'Rio de Janeiro', 600.00, 400.00, 300.00, 'SERVIÇOS', 'Nacional', 'SERVIÇOS');
    END IF;
    
    IF user1_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = user1_id AND destination_city = 'Santiago'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type, trip_reason) 
        VALUES (user1_id, '2024-05-12', 'Chile', 'Santiago', 1500.00, 900.00, 500.00, 'CHILE', 'Continental', 'CHILE');
    END IF;
END $$;